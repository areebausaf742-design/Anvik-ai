import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("image" in body) || !("prompt" in body)) return Response.json({ error: "Choose an image and tell ANVIK what to look for." }, { status: 400 });
    const { image, prompt, mediaType } = body as { image: unknown; prompt: unknown; mediaType: unknown };
    if (typeof image !== "string" || image.length > 4_200_000 || typeof prompt !== "string" || prompt.length > 1200 || typeof mediaType !== "string" || !supportedTypes.has(mediaType)) return Response.json({ error: "Use a JPG, PNG, WebP, or GIF image under 3 MB with a prompt under 1,200 characters." }, { status: 400 });
    const apiKey = request.headers.get("x-google-generative-ai-api-key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return Response.json({ error: "Add your free Gemini key in Settings to unlock live AI." }, { status: 503 });
    const result = streamText({ model: createGoogleGenerativeAI({ apiKey })("gemini-2.0-flash"), system: "You are ANVIK Vision. Describe only what is visible, distinguish observations from guesses, and be concise but useful.", messages: [{ role: "user", content: [{ type: "text", text: prompt.trim() || "Describe this image and point out the details that matter." }, { type: "image", image: new Uint8Array(Buffer.from(image, "base64")), mediaType }] }], onError: ({ error }) => console.error("ANVIK vision failed:", error) });
    return new Response(result.textStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "ANVIK could not inspect this image. Please try again." }, { status: 400 });
  }
}
