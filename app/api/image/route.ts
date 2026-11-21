import { generateImage } from "ai";
import { gateway } from "@ai-sdk/gateway";

const styles = new Set(["Cinematic", "Anime", "3D render", "Cyberpunk", "Photoreal"]);

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("prompt" in body)) return Response.json({ error: "Describe the image you want to create." }, { status: 400 });
    const { prompt, style } = body as { prompt: unknown; style?: unknown };
    if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1600) return Response.json({ error: "Write a prompt between 3 and 1,600 characters." }, { status: 400 });
    const selectedStyle = typeof style === "string" && styles.has(style) ? style : "Cinematic";
    const { image } = await generateImage({ model: gateway.image("openai/gpt-image-2"), prompt: `${selectedStyle} visual style. ${prompt.trim()}`, aspectRatio: "1:1" });
    return Response.json({ image: `data:${image.mediaType};base64,${image.base64}`, prompt: prompt.trim(), style: selectedStyle });
  } catch {
    return Response.json({ error: "Image generation is unavailable right now. Please try again shortly." }, { status: 502 });
  }
}
