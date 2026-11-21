import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("prompt" in body) || typeof body.prompt !== "string" || body.prompt.trim().length < 3 || body.prompt.length > 6000) {
      return Response.json({ error: "Describe the code you want to create." }, { status: 400 });
    }
    const apiKey = request.headers.get("x-google-generative-ai-api-key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return Response.json({ error: "Add your free Gemini key in Settings to unlock live AI." }, { status: 503 });
    const result = streamText({
      model: createGoogleGenerativeAI({ apiKey })("gemini-2.0-flash"),
      system: "You are ANVIK Code Lab. Return complete, correct code first in a fenced block, followed by a concise explanation. Never claim code was executed.",
      prompt: body.prompt.trim(),
    });
    return new Response(result.textStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Code generation is unavailable right now. Please try again." }, { status: 400 });
  }
}
