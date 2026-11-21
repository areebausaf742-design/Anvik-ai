import { cookies } from "next/headers";
import { detectLanguage, langLabel, type Lang } from "@/lib/detect";
import { CORPUS, FALLBACK, JAILBREAK_RE, SELFHARM_RE, SELFHARM_RESPONSE } from "@/lib/corpus";
import { store, estimateTokens, estimateCostPaise, RATE_PER_MIN, RATE_PER_HOUR, corpusMatch } from "@/lib/store";
import { streamAnswer } from "@/lib/provider";
import { slugify } from "@/lib/transliterate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/* sliding-window rate limits, in-process (§6.2; Postgres-owned in Week 6) */
const hits = new Map<string, number[]>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  const perMin = list.filter((t) => now - t < 60_000).length;
  if (perMin >= RATE_PER_MIN || list.length >= RATE_PER_HOUR) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const jar = await cookies();
  const deviceId = jar.get("anvik_dev")?.value ?? "nodev";

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

  /* §6.5: safety routes run BEFORE rate limits and quota. A cry for help must
     never be answered with "too many requests". */
  if (SELFHARM_RE.test(question)) {
    await store.logModeration({
      questionText: question.slice(0, 200),
      stage: "input",
      reasonCode: "self-harm",
      action: "helpline-routed",
    });
    await store.recordQuestion({ deviceId, text: question, lang, slug: null, idempotencyKey: idemKey || null, status: "refused" });
    return stream(req, SELFHARM_RESPONSE[lang], lang, deviceId, null, { model: "safety-route" });
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
      { message: "That’s all 3 free questions for today. Back tomorrow — or ₹19 for 25 (payments from Week 7).", code: "quota" },
      402,
    );

  /* idempotency: a retry after a network blip must not double-charge (§5.2) */
  if (idemKey) {
    const prior = store.idempotentAnswer(idemKey);
    if (prior) {
      return stream(req, prior.body, lang, deviceId, quotaLeft, {
        existingSlug: prior.slug,
        model: prior.model,
        fast: true,
      });
    }
  }

  /* §4.3 duplicate check before generation */
  const dup = store.findPublicMatch(question);
  if (dup) {
    await store.recordQuestion({ deviceId, text: question, lang, slug: dup.slug, idempotencyKey: idemKey || null, status: "duplicate" });
    return stream(req, dup.body, lang, deviceId, quotaLeft, { existingSlug: dup.slug, model: "corpus" });
  }

  /* demo retrieval; live provider from Week 1 */
  const hit = corpusMatch(question);
  const text = hit ? hit.answers[lang] : FALLBACK[lang];
  const matchedEntry = hit ? CORPUS.find((c) => c.id === hit.id) : null;

  return stream(req, text, lang, deviceId, quotaLeft, {
    idemKey,
    question,
    matchedQuestion: matchedEntry?.questions.hi ?? question,
  });
}

type StreamOpts = {
  existingSlug?: string;
  model?: string;
  fast?: boolean;
  idemKey?: string;
  question?: string;
  matchedQuestion?: string;
};

async function stream(
  req: Request,
  text: string,
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
        for await (const piece of streamAnswer(text, req.signal)) {
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
      const outputTokens = estimateTokens(out);
      const costPaise = estimateCostPaise(outputTokens);
      const model = opts.model ?? "demo-engine";

      if (!aborted && out.length > 0) {
        const baseSlug = opts.existingSlug ?? slugify(opts.matchedQuestion ?? opts.question ?? out.slice(0, 40));
        let slug = baseSlug;
        if (!opts.existingSlug && store.bySlug(slug)) slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
        if (!opts.existingSlug && opts.question) {
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
            promptTokens: 2270,
            outputTokens,
            cachedTokens: 2200,
            costPaise,
            latencyMs,
            isPublic: true,
            moderationState: "clean",
            lang,
            slug,
          });
          if (opts.idemKey) await store.bindIdempotency(opts.idemKey, a.id);
          slug = a.slug;
        }
        send(controller, { t: "done", slug, latencyMs, costPaise, outputTokens, model, demo: model === "demo-engine" });
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
