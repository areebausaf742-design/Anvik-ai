import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { modes, type ModeId } from "@/lib/prompts";
import { AI_MODEL, GEMINI_BASE_URL, resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";
import { CHAT_MAX_TOKENS, CODE_MAX_TOKENS, MAX_TEMPERATURE } from "@/lib/credit";
import { abuseReply, checkReply, encodeCheck, type CheckResult } from "@/lib/checker";
import { memoryInstruction, type Memory } from "@/lib/learning";

/**
 * Every answer in this product comes from Gemini. Nothing else answers.
 *
 * There is no corpus lookup, no answer cache and no local reply for greetings.
 * A previous version answered "what is car?" from the reviewed corpus because a
 * loose token-overlap match scored it as a scheme question — a confident wrong
 * answer wearing a "0 credits" badge. That whole layer is gone: if the model is
 * not reached, the user gets an honest error, never a substitute answer.
 *
 * The flow is deliberately short:
 *   validate → key → rate limit → Gemini → safety check → Gemini's answer
 *
 * The safety check can refuse an answer (abuse, invented helpline) but it never
 * rewrites one and never replaces it with text about another topic.
 */

export const maxDuration = 60;
const validModes = new Set<string>(modes.map(({ id }) => id));

const modeInstructions: Record<ModeId, string> = {
  fast: "Keep answers concise and prioritize the quickest useful response.",
  smart: "Think carefully and provide a clear, well-reasoned answer.",
  creative: "Explore fresh angles and expressive ideas while staying relevant.",
  coder: "Be precise about code, explain assumptions, and never claim code was executed.",
};

const SYSTEM = [
  "You are ANVIK, a warm, precise and resourceful personal AI.",
  "Answer the user's actual question on its own topic. Never switch topics and never substitute a prepared answer.",
  "Use Markdown when it improves readability.",
  "Never claim to have performed actions outside this conversation.",
  "Answer in the same language the user wrote in: Devanagari Hindi for Hindi, Roman-script Hinglish for Hinglish, English for English.",
  "Never invent a phone number, a link, a statistic or an official source. If you are not sure, say you are not sure.",
].join(" ");

const CAP = 7000;
const BUFFER_TIMEOUT_MS = 25_000;

type Buffered = { text: string; complete: boolean };

/** Read a provider stream into memory so the safety check can see the whole answer. */
async function readAnswer(stream: unknown): Promise<Buffered | { failed: true }> {
  const source = stream as {
    getReader?: () => ReadableStreamDefaultReader<string>;
    [Symbol.asyncIterator]?: () => AsyncIterator<string>;
  };

  let iterator: AsyncIterator<string>;
  try {
    if (typeof source.getReader === "function") {
      const reader = source.getReader();
      iterator = {
        next: () =>
          reader.read().then((chunk): IteratorResult<string> =>
            chunk.done ? { done: true, value: undefined } : { done: false, value: chunk.value },
          ),
        return: () => {
          reader.releaseLock();
          return Promise.resolve({ done: true as const, value: undefined });
        },
      };
    } else if (typeof source[Symbol.asyncIterator] === "function") {
      const factory = source[Symbol.asyncIterator];
      if (!factory) throw new Error("provider returned no stream");
      iterator = factory.call(source);
    } else {
      throw new Error("provider returned no stream");
    }
  } catch {
    return { failed: true };
  }

  const started = Date.now();
  let text = "";
  try {
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      if (typeof next.value === "string") text += next.value;
      if (text.length > CAP || Date.now() - started > BUFFER_TIMEOUT_MS) {
        return { text, complete: false };
      }
    }
  } catch {
    return { text, complete: false };
  }

  // The AI SDK ends a failed stream cleanly with no text: that is a failure,
  // not an empty answer (audit C-4 — it used to be a silent 200).
  if (!text.trim()) return { failed: true };
  return { text, complete: true };
}

function answer(
  text: string,
  check: CheckResult | null,
  extra: Record<string, string> = {},
) {
  const body = text + (check ? encodeCheck(check) : "");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-ANVIK-SOURCE": "gemini",
      "X-ANVIK-MODEL": AI_MODEL,
      "X-ANVIK-LABEL": "From Gemini",
      "X-ANVIK-CHECK": check ? (check.ok ? "ok" : "refused") : "partial",
      ...extra,
    },
  });
}

function refuseKey() {
  return Response.json(
    {
      error: "Add valid Gemini key in Settings.",
      detail: "Gemini rejected the request. Check the key, its quota, or try again shortly.",
    },
    { status: 401 },
  );
}

/** Only shapes the composer understands; bounded like the store. */
function readMemory(input: unknown): Memory | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Memory>;
  const lang = raw.lang === "hi" || raw.lang === "hi-Latn" ? raw.lang : "en";
  const style = raw.style === "detailed" || raw.style === "coder" ? raw.style : "short";
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!name && lang === "en" && style === "short") return null;
  return { name, lang, style, updatedAt: Date.now() };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body with a messages array." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("messages" in body)) {
    return Response.json({ error: "A conversation is required." }, { status: 400 });
  }

  const { messages, mode, temperature, memory } = body as {
    messages: unknown;
    mode?: unknown;
    temperature?: unknown;
    memory?: unknown;
  };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
  }

  const safeMessages = messages.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      !!message && typeof message === "object" && "role" in message && "content" in message &&
      ((message as { role: unknown }).role === "user" || (message as { role: unknown }).role === "assistant") &&
      typeof (message as { content: unknown }).content === "string" &&
      (message as { content: string }).content.trim().length > 0 &&
      (message as { content: string }).content.length <= 12000,
  );
  if (safeMessages.length !== messages.length || safeMessages[safeMessages.length - 1]?.role !== "user") {
    return Response.json({ error: "Prompt cannot be empty. Write a message and try again." }, { status: 400 });
  }

  const lastUser = safeMessages[safeMessages.length - 1].content.trim();
  if (lastUser.length < 2) {
    return Response.json({ error: "Prompt cannot be empty." }, { status: 400 });
  }

  /* key — one name, checked before anything else so a broken key is never
     masked by a helpful-looking fallback */
  const key = resolveKey(request);
  const suppliedClientKey = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (suppliedClientKey && suppliedClientKey.length < 20) return refuseKey();
  if (!key) return refuseKey();

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 12, 120)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  const selectedMode = (validModes.has(String(mode)) ? mode : "smart") as ModeId;
  const remembered = readMemory(memory);
  const system = [SYSTEM, modeInstructions[selectedMode], remembered ? memoryInstruction(remembered) : ""]
    .filter(Boolean)
    .join(" ");

  const tokenCap = selectedMode === "coder" ? CODE_MAX_TOKENS : CHAT_MAX_TOKENS;
  const requested = typeof temperature === "number" ? temperature : 0.65;
  const safeTemperature = Math.max(0, Math.min(MAX_TEMPERATURE, requested));

  const google = createGoogleGenerativeAI({
    apiKey: key,
    baseURL: GEMINI_BASE_URL,
  });

  const generate = (turns: { role: "user" | "assistant"; content: string }[]) =>
    streamText({
      model: google(AI_MODEL),
      system,
      messages: turns,
      temperature: safeTemperature,
      maxOutputTokens: tokenCap,
      abortSignal: request.signal,
    });

  /* Gemini — the only source of answers. The full conversation is sent: no
     summary stands in for what the user actually said. */
  let text: string;
  let complete: boolean;
  try {
    // `textStream`, not the result object: the result wraps the stream lazily
    // and exposes no reader, so passing it made every answer look like a 401.
    const first = await readAnswer(generate(safeMessages).textStream);
    if ("failed" in first) {
      // One retry before giving up: provider hiccups are common, invented
      // answers are not acceptable as a stand-in.
      const second = await readAnswer(generate(safeMessages).textStream);
      if ("failed" in second) return refuseKey();
      text = second.text;
      complete = second.complete;
    } else {
      text = first.text;
      complete = first.complete;
    }
  } catch {
    return refuseKey();
  }

  if (!complete) {
    // Do not present half an answer as an answer, and do not judge half an
    // answer. Say so plainly.
    return answer(`${text}\n\n_The model stopped mid-answer. Please ask again._`, null);
  }

  /* safety only: empty, abuse, invented helpline.
     `check.repaired` is the answer verbatim except when an invented helpline
     number had to be replaced with a pointer to the real one. Nothing else in
     the text is touched, and the subject is never changed. */
  const check = checkReply(text);
  if (!check.ok && check.issues.some((issue) => issue.code === "safety")) {
    return answer(abuseReply(), check);
  }

  return answer(check.repaired, check);
}
