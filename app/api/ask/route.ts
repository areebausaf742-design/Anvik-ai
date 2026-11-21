import { cookies } from "next/headers";
import { detectLanguage, langLabel, type Lang } from "@/lib/detect";
import { CORPUS, FALLBACK, JAILBREAK_RE, SELFHARM_RE, SELFHARM_RESPONSE } from "@/lib/corpus";
import {
  store,
  estimateTokens,
  estimateCostPaise,
  RATE_PER_MIN,
  RATE_PER_HOUR,
  DAILY_CEILING_PAISE,
  corpusMatch,
} from "@/lib/store";
import { openLive, parseLive, streamCorpus, LIVE_MODEL, liveKey, type Usage } from "@/lib/provider";
import { allow, clientIp, LIMIT_MESSAGE } from "@/lib/rate-limit";
import { slugify } from "@/lib/transliterate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/* Sliding-window rate limit (§6.2). Shared with the paid Gemini routes so one
   identity cannot dodge the cap by moving between endpoints. */
function rateOk(ip: string): boolean {
  return allow(`ask:${ip}`, RATE_PER_MIN, RATE_PER_HOUR);
}

/** Cost in paise from real token counts at Flash-class prices, ₹95/$ (§7.2). */
function costFromUsage(u: Usage): number | null {
  if (u.outputTokens === undefined) return null;
  const cached = u.cachedTokens ?? 0;
  const uncached = Math.max(0, (u.promptTokens ?? 0) - cached);
  const usd = (cached * 0.03 + uncached * 0.3 + u.outputTokens * 2.5) / 1_000_000;
  return Math.max(1, Math.round(usd * 95 * 100));
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch {
    /* A read-only disk, a missing Supabase table or a store bug must never
       surface as a 500 on a page people share. Degrade to the corpus. */
    return json({ message: "Answers are briefly unavailable. Please try again in a moment.", code: "degraded" }, 503);
  }
}

async function handle(req: Request) {
  const ip = clientIp(req);
  const jar = await cookies();
  const deviceId =
    jar.get("anvik_dev")?.value ?? req.headers.get("x-anvik-device")?.trim() ?? "nodev";

  let body: { question?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ message: "Could not read that request." }, 400);
  }
  const question = String(body.question ?? "").trim();
  const idemKey = String(body.key ?? "");

  if (question.length < 2) return json({ message: "Write a question first.", code: "empty" }, 400);
  if (question.length > 600)
    return json({ message: "That is over 600 characters — try a shorter question.", code: "long" }, 413);

  const lang: Lang = detectLanguage(question);

  /* Guard order is fixed (owner spec + §6.5): safety, jailbreak, rate, quota,
     ceiling. A cry for help is never rate-limited and never quota-limited. */
  if (SELFHARM_RE.test(question)) {
    await store.logModeration({
      questionText: question.slice(0, 200),
      stage: "input",
      reasonCode: "self-harm",
      action: "helpline-routed",
    });
    await store.recordQuestion({ deviceId, text: question, lang, slug: null, idempotencyKey: idemKey || null, status: "refused" });
    return stream(req, streamCorpus(SELFHARM_RESPONSE[lang], req.signal), lang, deviceId, null, {
      model: "safety-route",
    });
  }

  if (JAILBREAK_RE.test(question)) {
    await store.logModeration({
      questionText: question.slice(0, 200),
      stage: "input",
      reasonCode: "jailbreak",
      action: "refused",
    });
    return json({ message: "I can’t answer that one the way you’re asking.", code: "refused" }, 403);
  }

  if (!rateOk(ip))
    return json({ message: "Too fast — six questions a minute, max. Take a breath.", code: "rate" }, 429);

  const quotaLeft = await store.decrementQuota(deviceId);
  if (quotaLeft === null)
    return json(
      { message: "That’s all 3 free questions for today. Your quota resets at midnight IST.", code: "quota" },
      402,
    );

  /* Plan §7.4 control 1: global daily spend ceiling, checked before any spend. */
  if (store.todayCostPaise() >= DAILY_CEILING_PAISE)
    return json(
      {
        message: "We’ve reached today’s spend ceiling. Every public answer stays readable; new questions reopen tomorrow.",
        code: "ceiling",
      },
      503,
    );

  /* idempotency: a retry after a network blip must not double-charge (§5.2) */
  if (idemKey) {
    const prior = store.idempotentAnswer(idemKey);
    if (prior) {
      return stream(req, streamCorpus(prior.body, req.signal), lang, deviceId, quotaLeft, {
        existingSlug: prior.slug,
        model: prior.model,
      });
    }
  }

  /* §4.3 duplicate check: reuse a reviewed public answer only when its language
     matches the asker's — a Hindi asker never gets served an English body. */
  const dup = store.findPublicMatch(question);
  if (dup && dup.reviewed && dup.lang === lang) {
    await store.recordQuestion({ deviceId, text: question, lang, slug: dup.slug, idempotencyKey: idemKey || null, status: "duplicate" });
    return stream(req, streamCorpus(dup.body, req.signal), lang, deviceId, quotaLeft, {
      existingSlug: dup.slug,
      model: dup.model,
    });
  }

  /* Live provider first; corpus engine as fallback so the product never dies
     on a missing key or a provider outage. */
  if (liveKey()) {
    try {
      const up = await openLive(question, req.signal);
      if (up.ok && up.body) {
        const usage: Usage = {};
        return stream(req, parseLive(up.body, usage, req.signal), lang, deviceId, quotaLeft, {
          idemKey,
          question,
          usage,
          model: LIVE_MODEL,
        });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      /* fall through to corpus */
    }
  }

  const hit = corpusMatch(question);
  const text = hit ? hit.answers[lang] : FALLBACK[lang];
  const matched = hit ? CORPUS.find((c) => c.id === hit.id) : null;
  return stream(req, streamCorpus(text, req.signal), lang, deviceId, quotaLeft, {
    idemKey,
    question,
    matchedQuestion: matched?.questions[lang] ?? matched?.questions.en ?? question,
    model: hit ? "corpus" : "corpus-fallback",
  });
}

type StreamOpts = {
  existingSlug?: string;
  model?: string;
  idemKey?: string;
  question?: string;
  matchedQuestion?: string;
  usage?: Usage;
};

async function stream(
  req: Request,
  source: AsyncGenerator<string>,
  lang: Lang,
  deviceId: string,
  quotaLeft: number | null,
  opts: StreamOpts = {},
) {
  const enc = new TextEncoder();
  const started = performance.now();
  const send = (c: ReadableStreamDefaultController, obj: unknown) =>
    c.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

  const body = new ReadableStream({
    async start(controller) {
      send(controller, { t: "meta", lang, langLabel: langLabel(lang), quotaLeft, existingSlug: opts.existingSlug });
      let out = "";
      let aborted = false;
      try {
        for await (const piece of source) {
          if (req.signal.aborted) throw new DOMException("aborted", "AbortError");
          out += piece;
          send(controller, { t: "tok", s: piece });
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") aborted = true;
        else {
          send(controller, { t: "err", message: "The answer broke midway. Try once more." });
          controller.close();
          return;
        }
      }
      const latencyMs = Math.round(performance.now() - started);
      const outputTokens = opts.usage?.outputTokens ?? estimateTokens(out);
      const costPaise = costFromUsage(opts.usage ?? {}) ?? estimateCostPaise(outputTokens);
      const model = opts.model ?? "corpus";

      if (!aborted && out.length > 0) {
        const baseSlug = opts.existingSlug ?? slugify(opts.matchedQuestion ?? opts.question ?? out.slice(0, 40));
        let slug = baseSlug;
        if (!opts.existingSlug && opts.question) {
          if (store.bySlug(slug)) slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
          const q = await store.recordQuestion({
            deviceId,
            text: opts.question,
            lang,
            slug,
            idempotencyKey: opts.idemKey || null,
            status: "answered",
          });
          const a = await store.recordAnswer({
            questionId: q.id,
            body: out,
            model,
            promptTokens: opts.usage?.promptTokens ?? 2270,
            outputTokens,
            cachedTokens: opts.usage?.cachedTokens ?? 0,
            costPaise,
            latencyMs,
            isPublic: true,
            moderationState: "clean",
            reviewed: false, // noindex and out of the gallery until a human reviews
            lang,
            slug,
          });
          if (opts.idemKey) await store.bindIdempotency(opts.idemKey, a.id);
          slug = a.slug;
        }
        send(controller, { t: "done", slug, latencyMs, costPaise, outputTokens, model });
      } else if (aborted) {
        send(controller, { t: "stop", latencyMs });
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
