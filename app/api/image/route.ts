import { resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";

const styles = new Set(["Cinematic", "Anime", "3D Render", "Cyberpunk", "Realistic"]);
/** Gemini's image-capable model. Kept separate from AI_MODEL on purpose. */
const imageModel = process.env.ANVIK_IMAGE_MODEL ?? "gemini-2.0-flash-preview-image-generation";

type Generated = { url: string; provider: "gemini" | "pollinations" };

async function generateWithGemini(prompt: string, apiKey: string): Promise<Generated> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) throw new Error(`Gemini image generation failed (${response.status}).`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("candidates" in result) || !Array.isArray(result.candidates)) {
    throw new Error("Gemini returned no image.");
  }
  for (const candidate of result.candidates) {
    if (!candidate || typeof candidate !== "object" || !("content" in candidate) || !candidate.content) continue;
    const parts = (candidate.content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object" || !("inlineData" in part)) continue;
      const inline = (part as { inlineData?: { data?: unknown; mimeType?: unknown } }).inlineData;
      if (inline && typeof inline.data === "string") {
        const mime = typeof inline.mimeType === "string" ? inline.mimeType : "image/png";
        return { url: `data:${mime};base64,${inline.data}`, provider: "gemini" };
      }
    }
  }
  throw new Error("Gemini returned no image.");
}

/**
 * Pollinations returns its bytes directly. We hand back the *URL* rather than a
 * base64 blob (audit M-7 / item 7): the browser fetches and caches it, the
 * route never holds a multi-MB string, and the client can persist a URL in
 * localStorage instead of blowing the 5 MB quota.
 */
async function generateWithPollinations(prompt: string): Promise<Generated> {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("seed", String(Math.floor(Math.random() * 2_147_483_647)));
  url.searchParams.set("model", "flux");
  url.searchParams.set("nologo", "true");

  const response = await fetch(url, { signal: AbortSignal.timeout(90_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Pollinations image generation failed (${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("Image fallback returned an invalid response.");
  // Drain the body so the connection is released and the upstream cache fills.
  await response.arrayBuffer().catch(() => undefined);
  return { url: url.toString(), provider: "pollinations" };
}

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid image prompt." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("prompt" in body)) {
    return Response.json({ error: "Describe the image you want to create." }, { status: 400 });
  }

  const { prompt, style } = body as { prompt: unknown; style?: unknown };
  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return Response.json({ error: "Prompt cannot be empty." }, { status: 400 });
  }
  if (prompt.length > 1600) {
    return Response.json({ error: "Write a prompt between 3 and 1,600 characters." }, { status: 400 });
  }

  const supplied = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (supplied && supplied.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 4, 30)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  const selectedStyle = typeof style === "string" && styles.has(style) ? style : "Cinematic";
  const imagePrompt = prompt.trim();
  const key = resolveKey(request);

  if (key) {
    try {
      const image = await generateWithGemini(imagePrompt, key);
      return Response.json(
        { image: image.url, url: image.url, prompt: imagePrompt, style: selectedStyle, provider: image.provider },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      /* fall through to the free fallback: image studio must keep working */
    }
  }

  try {
    const image = await generateWithPollinations(imagePrompt);
    return Response.json(
      { image: image.url, url: image.url, prompt: imagePrompt, style: selectedStyle, provider: image.provider },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Image generation could not complete. Please try again in a moment." },
      { status: 502 },
    );
  }
}

