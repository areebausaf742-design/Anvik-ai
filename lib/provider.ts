/**
 * Provider seam (plan §5.2). One env name for the whole product:
 * GOOGLE_GENERATIVE_AI_API_KEY — server-side, never shipped to the browser.
 *
 * With it set, answers stream from the live Gemini API; without it, the
 * deterministic corpus engine answers so the product stays demonstrable.
 * The key never leaves the server: this module is imported only by routes.
 *
 * Endpoint verified against current docs (Nov 2026):
 *   POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse
 *   header x-goog-api-key; body { systemInstruction, contents, generationConfig }
 *   SSE lines carry candidates[0].content.parts[].text and a final usageMetadata.
 */

/** The one model id for the product. Every route reads it from here. */
export const AI_MODEL = process.env.ANVIK_MODEL ?? "gemini-2.0-flash";
export const LIVE_MODEL = AI_MODEL;

/**
 * The only accepted env name. Two legacy aliases used to exist and are gone on
 * purpose: two names meant /api/ask silently reported "demo engine" while
 * /api/chat had a key (audit C-1 / item 2).
 */
export function serverKey(): string | undefined {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || undefined;
}

/** Kept for /api/ask's historical call site. */
export const liveKey = serverKey;

/** A key supplied by this browser in Settings, validated as a Gemini key shape. */
export function clientKey(request: Request): string | undefined {
  const key = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (!key || key.length < 20) return undefined;
  return key;
}

/** Per-request key resolution: the caller's own key wins over the server's. */
export function resolveKey(request: Request): string | undefined {
  return clientKey(request) ?? serverKey();
}

/** Plan §7.4 control 3: hard output cap. Identical system prompt for every
 *  request so prompt caching stays possible. */
const MAX_OUTPUT_TOKENS = 600;

const SYSTEM = `You are Anvik, a plain-spoken answer engine.
Rules, in order:
1. Answer in the language the question was written in. Hindi questions get Devanagari Hindi; Hinglish gets Hinglish; English gets English. Never translate a question into another language.
2. Lead with the direct answer in one sentence, then numbered steps or bullets. No preamble, no "great question".
3. Keep it under 450 words. Concrete names, forms, sections, helplines and official website domains beat adjectives.
4. Cite official sources as plain-text domains (for example pmkisan.gov.in), never as markdown links.
5. Never diagnose illness or give medicine doses: say a doctor is needed and give the emergency number 108 (India) or Tele-MANAS 14416 for mental health.
6. Never predict legal case outcomes; explain process and documents only.
7. Never recommend buying or selling a specific stock, fund, scheme or crypto asset; explain how instruments work instead.
8. Rules change: end scheme or law answers with one line saying the official page governs.
9. If a question asks for harm, fraud, weapons or abuse of someone, refuse in one plain sentence without explaining how.`;

export type Usage = {
  promptTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
};

/** Open the live stream. Caller decides fallback if this rejects or !ok. */
export async function openLive(question: string, signal?: AbortSignal): Promise<Response> {
  const key = serverKey();
  if (!key) throw new Error("no key");
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${LIVE_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.4 },
      }),
      signal,
    },
  );
}

/** Parse Gemini SSE into text chunks; fills usage from the final frame. */
export async function* parseLive(
  body: ReadableStream<Uint8Array>,
  usage: Usage,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        let frame: {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            cachedContentTokenCount?: number;
          };
        };
        try {
          frame = JSON.parse(raw);
        } catch {
          continue;
        }
        const text = frame.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (text) yield text;
        if (frame.usageMetadata) {
          usage.promptTokens = frame.usageMetadata.promptTokenCount;
          usage.outputTokens = frame.usageMetadata.candidatesTokenCount;
          usage.cachedTokens = frame.usageMetadata.cachedContentTokenCount;
        }
      }
    }
  } finally {
    reader.releaseLock();
    void signal;
  }
}

/* ---------- corpus fallback (demo mode) ---------- */

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Word-cluster chunks of 5–11 chars: feels like token streaming, renders clean. */
function chunk(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    buf += w;
    if (buf.length >= 6 + Math.floor(Math.random() * 5) && /\s$/.test(buf)) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

export async function* streamCorpus(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  for (const piece of chunk(text)) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    yield piece;
    await sleep(14 + Math.random() * 26, signal);
  }
}

/**
 * Turn a provider stream into an honest HTTP response.
 *
 * `streamText()` is lazy: a rejected key fails on the *first read*, not at
 * call time. Returning `result.textStream` directly therefore produced
 * `200` with an empty body — the user saw a blank bubble and no error
 * (audit C-4). So the first chunk is pulled before the status is decided:
 * a failure here is a real 401 with a message, not a silent 200.
 */
export type StreamedLike = {
  getReader?: () => ReadableStreamDefaultReader<string>;
  [Symbol.asyncIterator]?: () => AsyncIterator<string>;
};

export async function guardedTextResponse(
  stream: unknown,
  failure: { status?: number; error?: string; detail?: string } = {},
): Promise<Response> {
  const status = failure.status ?? 401;
  const error = failure.error ?? "Add valid Gemini key in Settings.";
  const detail =
    failure.detail ?? "The model rejected the request. Check the key, its quota, or try again shortly.";

  const source = stream as StreamedLike;
  const encoder = new TextEncoder();

  // Normalise to an async iterator so both APIs work.
  let iterator: AsyncIterator<string>;
  try {
    if (typeof source.getReader === "function") {
      const reader = source.getReader();
      iterator = {
        next: () =>
          reader.read().then((r): IteratorResult<string> =>
            r.done ? { done: true, value: undefined } : { done: false, value: r.value },
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
    return Response.json({ error, detail }, { status });
  }

  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch {
    return Response.json({ error, detail }, { status });
  }

  // The AI SDK swallows provider failures: it logs them through `onError` and
  // ends the stream cleanly, which used to surface as `200` + a blank body.
  // An answer that produces no text at all is a failure, so report it as one.
  if (first.done || typeof first.value !== "string" || first.value.length === 0) {
    return Response.json({ error, detail }, { status });
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done && typeof first.value === "string" && first.value.length > 0) {
          controller.enqueue(encoder.encode(first.value));
        }
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          if (typeof next.value === "string" && next.value.length > 0) {
            controller.enqueue(encoder.encode(next.value));
          }
        }
      } catch {
        // Mid-stream failure: say so in the transcript instead of ending blank.
        controller.enqueue(
          encoder.encode("\n\n_The model stopped mid-answer. Please ask again._"),
        );
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by a cancel */
        }
      }
    },
    cancel() {
      void iterator.return?.(undefined);
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
