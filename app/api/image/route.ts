const styles = new Set(["Cinematic", "Anime", "3D Render", "Cyberpunk", "Realistic"]);
const model = "gemini-2.0-flash-preview-image-generation";

function asDataUrl(mimeType: string, data: string) {
  return `data:${mimeType};base64,${data}`;
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Gemini image generation failed (${response.status}).`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("candidates" in result) || !Array.isArray(result.candidates)) {
    throw new Error("Gemini returned no image.");
  }
  for (const candidate of result.candidates) {
    if (!candidate || typeof candidate !== "object" || !("content" in candidate) || !candidate.content || typeof candidate.content !== "object" || !("parts" in candidate.content) || !Array.isArray(candidate.content.parts)) continue;
    for (const part of candidate.content.parts) {
      if (part && typeof part === "object" && "inlineData" in part && part.inlineData && typeof part.inlineData === "object" && "data" in part.inlineData && typeof part.inlineData.data === "string") {
        const mimeType = "mimeType" in part.inlineData && typeof part.inlineData.mimeType === "string" ? part.inlineData.mimeType : "image/png";
        return asDataUrl(mimeType, part.inlineData.data);
      }
    }
  }
  throw new Error("Gemini returned no image.");
}

async function generateWithPollinations(prompt: string): Promise<string> {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("seed", String(Math.floor(Math.random() * 2_147_483_647)));
  url.searchParams.set("model", "flux");
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Pollinations image generation failed (${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("Image fallback returned an invalid response.");
  const image = Buffer.from(await response.arrayBuffer()).toString("base64");
  if (!image) throw new Error("Image fallback returned an empty image.");
  return asDataUrl(contentType, image);
}

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid image prompt." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("prompt" in body)) return Response.json({ error: "Describe the image you want to create." }, { status: 400 });
  const { prompt, style } = body as { prompt: unknown; style?: unknown };
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1600) return Response.json({ error: "Write a prompt between 3 and 1,600 characters." }, { status: 400 });
  const selectedStyle = typeof style === "string" && styles.has(style) ? style : "Cinematic";
  const apiKey = request.headers.get("x-google-generative-ai-api-key")?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const imagePrompt = prompt.trim();

  if (apiKey) {
    try {
      const image = await generateWithGemini(imagePrompt, apiKey);
      return Response.json({ image, prompt: imagePrompt, style: selectedStyle, provider: "gemini" }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.warn("ANVIK Gemini image generation failed; using Pollinations fallback.", error);
    }
  }

  try {
    const image = await generateWithPollinations(imagePrompt);
    return Response.json({ image, prompt: imagePrompt, style: selectedStyle, provider: "pollinations" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ANVIK Pollinations image fallback failed.", error);
    return Response.json({ error: "Image generation could not complete. Please try again." }, { status: 502 });
  }
}
