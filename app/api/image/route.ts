const styles = new Set(["Cinematic", "Anime", "3D render", "Cyberpunk", "Photoreal"]);

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("prompt" in body)) return Response.json({ error: "Describe the image you want to create." }, { status: 400 });
    const { prompt, style } = body as { prompt: unknown; style?: unknown };
    if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1600) return Response.json({ error: "Write a prompt between 3 and 1,600 characters." }, { status: 400 });
    const selectedStyle = typeof style === "string" && styles.has(style) ? style : "Cinematic";
    return Response.json({ error: "Gemini 2.0 Flash can understand and describe images, but it does not generate image files. Image generation needs a separate image-generation model." }, { status: 501 });
  } catch {
    return Response.json({ error: "Image generation is unavailable right now. Please try again shortly." }, { status: 502 });
  }
}
