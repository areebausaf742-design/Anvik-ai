/**
 * Provider seam (plan §5.2). With GEMINI_API_KEY (or GOOGLE_API_KEY) set in
 * server-side env, answers stream from the live Gemini API; without it, the
 * deterministic corpus engine answers so the product stays demonstrable.
 * The key never leaves the server: this module is imported only by /api/ask.
 *
 * Endpoint verified against current docs (Nov 2026):
 *   POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse
 *   header x-goog-api-key; body { systemInstruction, contents, generationConfig }
 *   SSE lines carry candidates[0].content.parts[].text and a final usageMetadata.
 */

export const LIVE_MODEL = process.env.ANVIK_MODEL ?? "gemini-2.5-flash";

export function liveKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? undefined;
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
  const key = liveKey();
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
