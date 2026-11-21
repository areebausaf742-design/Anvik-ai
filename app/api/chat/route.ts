import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { modes, type ModeId } from "@/lib/prompts";
import { AI_MODEL, guardedTextResponse, resolveKey, serverKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";

const demoReplies = [
  "Here’s a useful way to start: name the outcome you want, then break it into the smallest next step. Share a little more context and I can help shape a practical plan.",
  "A good first draft is rarely the final one. I’d begin with the main idea, add one concrete example, and then trim anything that doesn’t help the reader. Tell me the audience and I can tailor it.",
  "Let’s make this manageable: clarify the goal, list the constraints, and choose one action you can take today. If you share the details, I can help you work through them.",
];

function demoReply(input: string) {
  const text = input.toLowerCase();
  if (/code|bug|error|function|api/.test(text)) return "A solid debugging path is to reproduce the issue, inspect the exact input and error, then isolate the smallest failing case. Share the code and expected behavior and I can help trace it.";
  if (/write|email|draft|story|post/.test(text)) return "Start with the one thing your reader should remember. Use a direct opening, add only the context they need, and end with a clear next step. Tell me the tone and audience to make this more specific.";
  if (/plan|goal|week|project|steps/.test(text)) return "Try this simple plan: define the outcome, identify your top three constraints, and choose the smallest meaningful next action. I can help turn your details into a step-by-step plan.";
  return demoReplies[Math.abs([...text].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % demoReplies.length];
}

export const maxDuration = 60;
const validModes = new Set<string>(modes.map(({ id }) => id));
const modeInstructions: Record<ModeId, string> = {
  fast: "Keep answers concise and prioritize the quickest useful response.",
  smart: "Think carefully and provide a clear, well-reasoned answer.",
  creative: "Explore fresh angles and expressive ideas while staying relevant.",
  coder: "Be precise about code, explain assumptions, and never claim code was executed.",
};

/** Plain-text stream so the client can concatenate chunks directly. */
function textStream(text: string, status = 200) {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-ANVIK-DEMO": "true",
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body with a messages array." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("messages" in body)) {
    return Response.json({ error: "A conversation is required." }, { status: 400 });
  }

  const { messages, mode, temperature } = body as { messages: unknown; mode?: unknown; temperature?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
  }

  const safeMessages = messages.filter((message): message is { role: "user" | "assistant"; content: string } =>
    !!message && typeof message === "object" && "role" in message && "content" in message &&
    ((message as { role: unknown }).role === "user" || (message as { role: unknown }).role === "assistant") &&
    typeof (message as { content: unknown }).content === "string" &&
    (message as { content: string }).content.trim().length > 0 &&
    (message as { content: string }).content.length <= 12000,
  );
  if (safeMessages.length !== messages.length || safeMessages[safeMessages.length - 1]?.role !== "user") {
    return Response.json(
      { error: "Prompt cannot be empty. Write a message and try again." },
      { status: 400 },
    );
  }

  const lastUser = safeMessages[safeMessages.length - 1].content.trim();
  if (lastUser.length < 2) {
    return Response.json({ error: "Prompt cannot be empty." }, { status: 400 });
  }

  const key = resolveKey(request);
  const serverSide = serverKey();
  // A browser-supplied key that is malformed must not be silently ignored:
  // the user asked for live AI, so tell them the key is the problem.
  const suppliedClientKey = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (suppliedClientKey && suppliedClientKey.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }
  if (!key) {
    // No key anywhere: demo mode. Explicit header + a body, never a 500.
    return textStream(demoReply(lastUser));
  }
  void serverSide;

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 12, 120)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  const selectedMode = (validModes.has(String(mode)) ? mode : "smart") as ModeId;
  const google = createGoogleGenerativeAI({ apiKey: key, baseURL: "https://generativelanguage.googleapis.com/v1beta" });

  try {
    const result = streamText({
      model: google(AI_MODEL),
      system: `You are ANVIK, a warm, precise and resourceful personal AI. Be direct, useful and thoughtful. Use Markdown when it improves readability. Never claim to have performed actions outside this conversation. ${modeInstructions[selectedMode]}`,
      messages: safeMessages,
      temperature: typeof temperature === "number" ? Math.min(1, Math.max(0, temperature)) : 0.65,
      abortSignal: request.signal,
    });
    return await guardedTextResponse(result.textStream, {
      status: 401,
      error: "Add valid Gemini key in Settings.",
      detail: "Gemini rejected the request. Check the key, its quota, or try again shortly.",
    });
  } catch {
    // Provider rejected the key or is down: say so. Never a 200 with no body.
    return Response.json(
      {
        error: "Add valid Gemini key in Settings.",
        detail: "Gemini rejected the request. Check the key, its quota, or try again shortly.",
      },
      { status: 401 },
    );
  }
}
