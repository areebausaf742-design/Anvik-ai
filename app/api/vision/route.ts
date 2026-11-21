import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { AI_MODEL, guardedTextResponse, resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** 3 MB of image becomes ~4 MB of base64; allow the encoding overhead once. */
const MAX_BASE64 = 4_400_000;

/** Accept bare base64 or a full data: URL, and normalise to bare base64. */
function normaliseBase64(value: string): string {
  const comma = value.startsWith("data:") ? value.indexOf(",") : -1;
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body with an image." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("image" in body)) {
    return Response.json({ error: "Choose an image and tell ANVIK what to look for." }, { status: 400 });
  }

  const { image, prompt, mediaType } = body as { image: unknown; prompt: unknown; mediaType: unknown };
  if (typeof image !== "string" || image.length === 0) {
    return Response.json({ error: "Choose an image and tell ANVIK what to look for." }, { status: 400 });
  }
  if (typeof mediaType !== "string" || !supportedTypes.has(mediaType)) {
    return Response.json({ error: "Use a JPG, PNG, WebP, or GIF image." }, { status: 400 });
  }

  const data = normaliseBase64(image);
  if (data.length > MAX_BASE64) {
    return Response.json({ error: "Use an image under 3 MB." }, { status: 413 });
  }
  const question = typeof prompt === "string" ? prompt.slice(0, 1200) : "";

  const supplied = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (supplied && supplied.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }

  const key = resolveKey(request);
  if (!key) {
    return Response.json(
      {
        error: "Add valid Gemini key in Settings.",
        detail: "Vision needs a Gemini key to look at an image. Paste a free one in Settings.",
      },
      { status: 401 },
    );
  }

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 6, 60)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  try {
    const result = streamText({
      model: createGoogleGenerativeAI({ apiKey: key })(AI_MODEL),
      system:
        "You are ANVIK Vision. Describe only what is visible, distinguish observations from guesses, and be concise but useful.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: question.trim() || "Describe this image and point out the details that matter.",
            },
            { type: "image", image: new Uint8Array(Buffer.from(data, "base64")), mediaType },
          ],
        },
      ],
      abortSignal: request.signal,
    });
    return await guardedTextResponse(result.textStream, {
      status: 401,
      error: "Add valid Gemini key in Settings.",
      detail: "Gemini could not inspect this image.",
    });
  } catch {
    return Response.json(
      { error: "Add valid Gemini key in Settings.", detail: "Gemini could not inspect this image." },
      { status: 401 },
    );
  }
}
