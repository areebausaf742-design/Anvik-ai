import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { AI_MODEL, guardedTextResponse, resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body with a transcript." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("transcript" in body) || typeof body.transcript !== "string") {
    return Response.json({ error: "Share a voice transcript to get a response." }, { status: 400 });
  }
  const transcript = body.transcript.trim();
  if (transcript.length < 1) {
    return Response.json({ error: "Prompt cannot be empty." }, { status: 400 });
  }
  if (body.transcript.length > 6000) {
    return Response.json({ error: "Keep the transcript under 6,000 characters." }, { status: 400 });
  }

  const supplied = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (supplied && supplied.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }

  const key = resolveKey(request);
  if (!key) {
    return Response.json(
      {
        error: "Add valid Gemini key in Settings.",
        detail: "Voice mode transcribed your words in the browser. A Gemini key turns them into an answer.",
      },
      { status: 401 },
    );
  }

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 8, 80)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  try {
    const result = streamText({
      model: createGoogleGenerativeAI({ apiKey: key })(AI_MODEL),
      system: "You are ANVIK Voice, a warm, concise conversational assistant. Respond naturally to the user's spoken message. Use Markdown only when it genuinely helps.",
      prompt: transcript,
      abortSignal: request.signal,
    });
    return await guardedTextResponse(result.textStream, {
      status: 401,
      error: "Add valid Gemini key in Settings.",
      detail: "Gemini rejected the voice request.",
    });
  } catch {
    return Response.json(
      { error: "Add valid Gemini key in Settings.", detail: "Gemini rejected the voice request." },
      { status: 401 },
    );
  }
}
