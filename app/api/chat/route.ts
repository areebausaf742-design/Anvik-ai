import { streamText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { modes, type ModeId } from "@/lib/prompts";

export const maxDuration = 60;
const validModes = new Set<string>(modes.map(({ id }) => id));

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
    const model = modes.find(({ id }) => id === selectedMode)!.model;
    const result = streamText({
      model: gateway(model),
      system: "You are ANVIK, a warm, precise and resourceful personal AI. Be direct, useful and thoughtful. Use Markdown when it improves readability. Never claim to have performed actions outside this conversation.",
      messages: safeMessages,
      temperature: typeof temperature === "number" ? Math.min(1, Math.max(0, temperature)) : 0.65,
      onError: ({ error }) => console.error("ANVIK stream failed:", error),
    });
    return new Response(result.textStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Your message could not be processed. Please try again." }, { status: 400 });
  }
}
