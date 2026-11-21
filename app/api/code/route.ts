import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { AI_MODEL, guardedTextResponse, resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";

export const maxDuration = 60;

const LANGUAGES = new Set(["TypeScript", "JavaScript", "Python", "CSS", "SQL"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body with a prompt." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("prompt" in body) || typeof body.prompt !== "string") {
    return Response.json({ error: "Describe the code you want to create." }, { status: 400 });
  }
  const prompt = body.prompt.trim();
  if (prompt.length < 3) {
    return Response.json({ error: "Prompt cannot be empty." }, { status: 400 });
  }
  if (body.prompt.length > 6000) {
    return Response.json({ error: "Keep the brief under 6,000 characters." }, { status: 400 });
  }

  const requestedLanguage = (body as { language?: unknown }).language;
  const language =
    typeof requestedLanguage === "string" && LANGUAGES.has(requestedLanguage)
      ? requestedLanguage
      : "TypeScript";

  const supplied = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (supplied && supplied.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }

  const key = resolveKey(request);
  if (!key) {
    return Response.json(
      {
        error: "Add valid Gemini key in Settings.",
        detail: "Code Lab needs a Gemini key. Paste a free one from Google AI Studio in Settings.",
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
      system: `You are ANVIK Code Lab. The user wants ${language}. Return complete, correct ${language} code first in a single fenced block, followed by a short explanation of the key decisions. Never claim code was executed.`,
      prompt,
      abortSignal: request.signal,
    });
    return await guardedTextResponse(result.textStream, {
      status: 401,
      error: "Add valid Gemini key in Settings.",
      detail: "Gemini rejected the code request.",
    });
  } catch {
    return Response.json(
      { error: "Add valid Gemini key in Settings.", detail: "Gemini rejected the code request." },
      { status: 401 },
    );
  }
}
