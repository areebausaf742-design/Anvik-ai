/**
 * Provider interface (plan §5.2). One seam: today it is the demo engine,
 * from Week 1 onward it is a live Flash-class model behind the same shape.
 *
 * Demo engine rules:
 *  - streams word-clusters, never mid-grapheme (Devanagari clusters stay whole)
 *  - honours AbortSignal so रोकें is real
 *  - reports the same meta a live provider will (lang, tokens, cost, latency)
 */

export type StreamMeta = {
  lang: string;
  quotaLeft: number | null;
  existingSlug?: string;
};

export type StreamDone = {
  slug: string;
  latencyMs: number;
  costPaise: number;
  outputTokens: number;
  model: string;
  demo: boolean;
};

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

export async function* streamAnswer(
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  for (const piece of chunk(text)) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    yield piece;
    await sleep(14 + Math.random() * 26, signal);
  }
}
