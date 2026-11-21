import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { modes, type ModeId } from "@/lib/prompts";
import { AI_MODEL, resolveKey } from "@/lib/provider";
import { allow, clientIdentity, LIMIT_MESSAGE } from "@/lib/rate-limit";
import { detectLanguage, type Lang } from "@/lib/detect";
import {
  CHAT_MAX_TOKENS,
  CODE_MAX_TOKENS,
  MAX_TEMPERATURE,
  cacheKey,
  corpusAnswer,
  creditLabel,
  fallbackAnswer,
  localAnswer,
  memoryGet,
  memorySet,
  prepareHistory,
  type CreditSource,
  type Turn,
} from "@/lib/credit";
import { checkReply, encodeCheck, repairPrompt, type CheckResult } from "@/lib/checker";
import { memoryInstruction, type Memory } from "@/lib/learning";

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

/**
 * Demo mode speaks the user's language. The English text above is kept intact
 * and translated once, rather than duplicating four branches in three scripts.
 */
function demoFor(input: string, lang: Lang): string {
  const english = demoReply(input);
  if (lang === "en") return english;
  if (lang === "hi") {
    if (english.startsWith("A solid debugging")) {
      return "डिबग करने का सीधा रास्ता: गड़बड़ी दोहराएँ, इनपुट और त्रुटि को ठीक से देखें, फिर सबसे छोटा टुकड़ा अलग करें जो अब भी विफल होता है। कोड और अपेक्षित व्यवहार भेजिए, मैं उसे ट्रेस करने में मदद करूँगा।";
    }
    if (english.startsWith("Start with the one thing")) {
      return "शुरुआत उस एक बात से करें जो पाठक को याद रहनी चाहिए। सीधी शुरुआत रखें, केवल उतना संदर्भ दें जितना ज़रूरी है, और अंत स्पष्ट अगले कदम पर करें। लहजा और पाठक बता दें तो यह और सटीक हो जाएगा।";
    }
    if (english.startsWith("Try this simple plan")) {
      return "छोटी योजना आज़माएँ: लक्ष्य तय करें, तीन सबसे बड़ी बाधाएँ पहचानें, और आज हो सकने वाला सबसे छोटा काम चुनें। विवरण दें तो मैं उसे कदम-दर-कदम योजना में बदल दूँगा।";
    }
    return "शुरुआत यहाँ से करें: चाहा हुआ नतीजा लिखें, फिर उसे सबसे छोटे अगले कदम में तोड़ें। थोड़ा संदर्भ दें तो मैं एक व्यावहारिक योजना बनाने में मदद कर सकता हूँ।";
  }
  if (english.startsWith("A solid debugging")) {
    return "Debug karne ka seedha raasta: gadbad dobara banayein, input aur error dhyan se dekhein, phir sabse chhota hissa alag karein jo ab bhi fail hota hai. Code aur expected behaviour bhejiye, main trace karne mein madad karunga.";
  }
  if (english.startsWith("Start with the one thing")) {
    return "Shuruaat us ek baat se karein jo padhne wale ko yaad rehni chahiye. Seedhi shuruaat rakhein, sirf utna sandarbh dein jitna zaroori hai, aur ant saaf agle kadam par karein. Tone aur audience bata dein to yeh aur sateek ho jayega.";
  }
  if (english.startsWith("Try this simple plan")) {
    return "Chhoti yojana aazmayein: lakshya tay karein, teen sabse badi badhaayein pehchanein, aur aaj ho sakne wala sabse chhota kaam chunein. Vivran dein to main use kadam-dar-kadam yojana mein badal dunga.";
  }
  return "Shuruaat yahan se karein: chaaha hua nateeja likhein, phir use sabse chhote agle kadam mein todein. Thoda sandarbh dein to main ek vyavaharik yojana banane mein madad kar sakta hoon.";
}

export const maxDuration = 60;
const validModes = new Set<string>(modes.map(({ id }) => id));
const modeInstructions: Record<ModeId, string> = {
  fast: "Keep answers concise and prioritize the quickest useful response.",
  smart: "Think carefully and provide a clear, well-reasoned answer.",
  creative: "Explore fresh angles and expressive ideas while staying relevant.",
  coder: "Be precise about code, explain assumptions, and never claim code was executed.",
};

/**
 * Every reply declares how it was produced, so the UI can show an honest
 * credit label instead of guessing.
 */
function labelled(
  text: string,
  source: CreditSource,
  demo: boolean,
  extra: Record<string, string> = {},
) {
  const body = new TextEncoder().encode(text);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-ANVIK-SOURCE": source,
      "X-ANVIK-CREDIT": creditLabel(source),
      "X-ANVIK-FREE": source === "model" ? "false" : "true",
      // A free answer must not hide the fact that live AI is still off.
      ...(demo ? { "X-ANVIK-DEMO": "true" } : {}),
      ...extra,
    },
  });
}

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
      "X-ANVIK-SOURCE": "corpus",
    },
  });
}

/** Collections accepted for the memory block; anything else is dropped. */
function readMemory(input: unknown): Memory | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Memory>;
  const lang: Lang = raw.lang === "hi" || raw.lang === "hi-Latn" ? raw.lang : "en";
  const style = raw.style === "detailed" || raw.style === "coder" ? raw.style : "short";
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!name && lang === "en" && style === "short") return null;
  return { name, lang, style, updatedAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/* buffered, checked generation                                        */
/* ------------------------------------------------------------------ */

const ANSWER_CAP = 7000; // characters buffered before falling back to pass-through
const BUFFER_TIMEOUT_MS = 25_000;

type Buffered = { text: string; complete: boolean };

/**
 * Read a provider stream into memory so the checker can see the whole answer.
 *
 * This is the price of checking: a reply cannot be judged until it is finished.
 * Chat answers are capped at 800 tokens (~3,200 characters), so the wait is one
 * normal generation. If a stream runs past the cap or the clock, the rest is
 * passed through unexamined and the reply is marked unchecked rather than
 * delayed further.
 */
async function readAnswer(stream: unknown): Promise<Buffered | { failed: true }> {
  const source = stream as {
    getReader?: () => ReadableStreamDefaultReader<string>;
    [Symbol.asyncIterator]?: () => AsyncIterator<string>;
  };

  let iterator: AsyncIterator<string>;
  try {
    if (typeof source.getReader === "function") {
      const reader = source.getReader();
      iterator = {
        next: () =>
          reader.read().then((chunk): IteratorResult<string> =>
            chunk.done ? { done: true, value: undefined } : { done: false, value: chunk.value },
          ),
        return: () => {
          reader.releaseLock();
          return Promise.resolve({ done: true as const, value: undefined });
        },
      };
    } else if (typeof source[Symbol.asyncIterator] === "function") {
      const factory = source[Symbol.asyncIterator];
      if (!factory) throw new Error("provider returned no stream");
      iterator = factory.call(source);
    } else {
      throw new Error("provider returned no stream");
    }
  } catch {
    return { failed: true };
  }

  const started = Date.now();
  let text = "";
  try {
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      if (typeof next.value === "string") text += next.value;
      if (text.length > ANSWER_CAP || Date.now() - started > BUFFER_TIMEOUT_MS) {
        return { text, complete: false };
      }
    }
  } catch {
    // A break mid-answer still leaves what we already have; the caller decides
    // whether that is enough or whether a fallback answer is better.
    return { text, complete: false };
  }

  // The AI SDK ends a failed stream cleanly with no text: that is a failure,
  // not an empty answer (audit C-4 — it used to be a silent 200).
  if (!text.trim()) return { failed: true };
  return { text, complete: true };
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

  const { messages, mode, temperature, memory, smart } = body as {
    messages: unknown;
    mode?: unknown;
    temperature?: unknown;
    memory?: unknown;
    smart?: unknown;
  };
  // Smart Mode can be switched off in the composer; when it is, greetings,
  // cache replays and corpus shortcuts are skipped and the model is asked.
  const smartMode = smart !== false;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
  }

  const safeMessages = messages.filter((message): message is Turn =>
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

  const selectedMode = (validModes.has(String(mode)) ? mode : "smart") as ModeId;
  const lang = detectLanguage(lastUser);

  const key = resolveKey(request);
  const demo = !key;
  // A browser-supplied key that is malformed must not be silently ignored:
  // the user asked for live AI, so tell them the key is the problem. This sits
  // above the free paths so a broken key is never masked by a canned answer.
  const suppliedClientKey = request.headers.get("x-google-generative-ai-api-key")?.trim();
  if (suppliedClientKey && suppliedClientKey.length < 20) {
    return Response.json({ error: "Add valid Gemini key in Settings." }, { status: 401 });
  }

  /* 1. local answer — no network, no credit ------------------------- */
  const local = smartMode ? localAnswer(lastUser) : null;
  if (local) {
    return labelled(local.reply, "local", demo, {
      "X-ANVIK-LABEL": "Answered on this device - 0 credits",
    });
  }

  /* 2. answer cache — 7 days, per language and mode ----------------- */
  const cKey = cacheKey(lastUser, lang, selectedMode);
  const cached = smartMode ? memoryGet(cKey) : undefined;
  if (cached) {
    return labelled(cached.answer, "cache", demo, { "X-ANVIK-LABEL": "From memory - 0 credits used" });
  }

  /* 3. reviewed corpus — only on a strong match --------------------- */
  const fromCorpus = smartMode ? corpusAnswer(lastUser, lang, 0.8) : null;
  if (fromCorpus) {
    // Not cached in demo mode: the reviewed text is always available anyway.
    if (!demo) memorySet(cKey, fromCorpus, lang);
    return labelled(fromCorpus, "corpus", demo, {
      "X-ANVIK-LABEL": "From the reviewed answer set - 0 credits",
    });
  }

  if (!key) {
    // No key anywhere: demo mode. Explicit header + a body, never a 500.
    return textStream(demoFor(lastUser, lang));
  }

  if (!allow(clientIdentity(request, request.headers.get("x-anvik-device")), 12, 120)) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  /* 4. the one model call ------------------------------------------- */
  const history = prepareHistory(safeMessages);
  const remembered = readMemory(memory);
  const system = [
    "You are ANVIK, a warm, precise and resourceful personal AI. Be direct, useful and thoughtful.",
    "Use Markdown when it improves readability.",
    "Never claim to have performed actions outside this conversation.",
    "Answer in the same language the user wrote in: Devanagari Hindi for Hindi, Roman-script Hinglish for Hinglish, English for English.",
    "Never invent a phone number, a link, a statistic or an official source. If you are not sure, say you are not sure.",
    modeInstructions[selectedMode],
    remembered ? memoryInstruction(remembered) : "",
    history.summary ? `Conversation so far (summarised): ${history.summary}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tokenCap = selectedMode === "coder" ? CODE_MAX_TOKENS : CHAT_MAX_TOKENS;
  const requested = typeof temperature === "number" ? temperature : 0.65;
  const safeTemperature = Math.max(0, Math.min(MAX_TEMPERATURE, requested));

  const google = createGoogleGenerativeAI({
    apiKey: key,
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
  });

  const generate = (turns: Turn[]) =>
    streamText({
      model: google(AI_MODEL),
      system,
      messages: turns,
      temperature: safeTemperature,
      maxOutputTokens: tokenCap,
      abortSignal: request.signal,
    });

  let answer: string;
  let partial = false;
  try {
    const first = await readAnswer(generate(history.messages));
    if ("failed" in first) {
      // Provider rejected the key or is down: say so, exactly as before.
      return Response.json(
        {
          error: "Add valid Gemini key in Settings.",
          detail: "Gemini rejected the request. Check the key, its quota, or try again shortly.",
        },
        { status: 401 },
      );
    }
    answer = first.text;
    // A stream that stopped early must say so, exactly as the old pass-through
    // guard did — a silently truncated answer is worse than an honest note.
    if (!first.complete) {
      answer = `${answer}\n\n_The model stopped mid-answer. Please ask again._`;
      partial = true;
    }
  } catch {
    return Response.json(
      {
        error: "Add valid Gemini key in Settings.",
        detail: "Gemini rejected the request. Check the key, its quota, or try again shortly.",
      },
      { status: 401 },
    );
  }

  /* 5. self-check, then at most one repair attempt ------------------- */
  let check: CheckResult = checkReply(answer, { prompt: lastUser, expectedLang: lang });
  let repaired = false;

  if (partial) {
    // Half an answer cannot be judged; hand it over unmarked and uncached.
    return labelled(answer, "model", false, {
      "X-ANVIK-CHECK": "partial",
      "X-ANVIK-SAVED": String(history.savedPercent),
      "X-ANVIK-TOKENS": `${history.tokensBefore}->${history.tokensAfter}`,
    });
  }

  if (!check.ok && !check.issues.some((issue) => issue.code === "empty")) {
    repaired = true;
    try {
      const second = await readAnswer(
        generate([
          ...history.messages,
          { role: "assistant", content: answer },
          { role: "user", content: repairPrompt(check.issues, lang) },
        ]),
      );
      if (!("failed" in second) && second.text.trim()) {
        const recheck = checkReply(second.text, { prompt: lastUser, expectedLang: lang });
        // Keep the second answer only if it is at least as good as the repair
        // of the first; otherwise fall back to the repaired original.
        if (recheck.issues.length <= check.issues.length || recheck.ok) {
          check = recheck;
          answer = second.text;
        }
      }
    } catch {
      // The repair attempt is best-effort: keep the repaired first answer.
    }
  }

  const finalText = check.repaired || answer;
  if (!finalText.trim()) {
    // Last resort: never a blank bubble.
    const safe = corpusAnswer(lastUser, lang, 0.5) ?? fallbackAnswer(lang);
    return labelled(safe, "corpus", false, {
      "X-ANVIK-LABEL": "Fallback answer - 0 credits",
      "X-ANVIK-CHECK": "failed",
    });
  }

  // A clean answer is worth replaying for a week; a repaired one is not, and
  // neither is one that failed a blocking check.
  if (check.ok && smartMode) memorySet(cKey, finalText, lang);

  return labelled(finalText + encodeCheck(check), "model", false, {
    "X-ANVIK-CHECK": check.ok ? "ok" : "fixed",
    "X-ANVIK-REPAIRED": String(repaired),
    "X-ANVIK-SAVED": String(history.savedPercent),
    "X-ANVIK-TOKENS": `${history.tokensBefore}->${history.tokensAfter}`,
  });
}

