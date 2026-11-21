import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("transcript" in body) || typeof body.transcript !== "string" || body.transcript.trim().length < 1 || body.transcript.length > 6000) {
      return Response.json({ error: "Share a voice transcript to get a response." }, { status: 400 });
    }
    const apiKey = request.headers.get("x-google-generative-ai-api-key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return Response.json({ error: "Add your free Gemini key in Settings to unlock live AI." }, { status: 503 });
    const result = streamText({
      model: createGoogleGenerativeAI({ apiKey })("gemini-2.0-flash"),
      system: "You are ANVIK Voice, a warm, concise conversational assistant. Respond naturally to the user's spoken message.",
      prompt: body.transcript.trim(),
    });
    return new Response(result.textStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Voice assistance is unavailable right now. Please try again." }, { status: 400 });
  }
}
