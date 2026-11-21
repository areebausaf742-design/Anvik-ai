import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { modes, type ModeId } from "@/lib/prompts";

const modelId = "gemini-2.0-flash";
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

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
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
      typeof (message as { content: unknown }).content === "string" && (message as { content: string }).content.length <= 12000,
    );
    if (safeMessages.length !== messages.length || safeMessages[safeMessages.length - 1]?.role !== "user") {
      return Response.json({ error: "The latest message must be a valid user message." }, { status: 400 });
    }
    const selectedMode = (validModes.has(String(mode)) ? mode : "smart") as ModeId;
    const apiKey = request.headers.get("x-google-generative-ai-api-key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      const text = demoReply(safeMessages[safeMessages.length - 1].content);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      }), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-ANVIK-DEMO": "true" } });
    }
    const google = createGoogleGenerativeAI({ apiKey });
    const result = streamText({
      model: google(modelId),
      system: `You are ANVIK, a warm, precise and resourceful personal AI. Be direct, useful and thoughtful. Use Markdown when it improves readability. Never claim to have performed actions outside this conversation. ${modeInstructions[selectedMode]}`,
      messages: safeMessages,
      temperature: typeof temperature === "number" ? Math.min(1, Math.max(0, temperature)) : 0.65,
      onError: ({ error }) => console.error("ANVIK stream failed:", error),
    });
    return new Response(result.textStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Your message could not be processed. Please try again." }, { status: 400 });
  }
}
