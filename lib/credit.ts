/**
 * Credit control — the "almost free" layer.
 *
 * Four things decide whether a message costs a model call:
 *   1. Local answers   — greetings and small talk never leave the machine.
 *   2. Cache           — the same prompt inside 7 days is replayed from memory.
 *   3. Learning store  — a question whose answer the user liked is reused.
 *   4. History summary — only the last 6 turns plus a summary of older ones.
 *
 * Isomorphic on purpose: the route uses the decision functions and the token
 * estimate; the browser uses the cache and the counters.
 */

import { detectLanguage, type Lang } from "./detect";
import { CORPUS, FALLBACK, type CorpusEntry } from "./corpus";

export type CreditSource = "local" | "cache" | "learning" | "corpus" | "model";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SOFT_DAILY_LIMIT = 100;
/** Every model call is capped. Flash only — no Pro, no reasoning tiers. */
export const CHAT_MAX_TOKENS = 800;
export const CODE_MAX_TOKENS = 1500;
export const MAX_TEMPERATURE = 0.7;
export const HISTORY_WINDOW = 6;

/* ------------------------------------------------------------------ */
/* 1. local answers — zero credit                                      */
/* ------------------------------------------------------------------ */

type LocalRule = {
  match: RegExp;
  /** the answer, per language */
  reply: Record<Lang, string>;
};

/**
 * Written as a real assistant would speak, not as filler. These never reach a
 * model, so they must be complete sentences worth reading on their own.
 */
const LOCAL_RULES: LocalRule[] = [
  {
    match:
      /^(hi+|hii+|hello+|hey+|yo|namaste|namaskar|salaam|hola|good (morning|afternoon|evening)|नमस्ते|नमस्कार|हैलो|सलाम)[\s!.,।]*$/i,
    reply: {
      en: "Hello. What would you like to work through? You can ask about a government form, a notice you received, or something you are trying to write or build.",
      hi: "नमस्ते। आप क्या समझना चाहते हैं? किसी सरकारी फ़ॉर्म, आए हुए नोटिस, या किसी चीज़ को लिखने या बनाने में मदद माँग सकते हैं।",
      "hi-Latn": "Namaste. Aap kya samajhna chahte hain? Kisi sarkari form, aaye hue notice, ya kisi cheez ko likhne ya banane mein madad maang sakte hain.",
    },
  },
  {
    match:
      /^(thanks?|thank you|thankyou|thx|shukriya|dhanyavad|dhanyawad|dhanyavaad|धन्यवाद|शुक्रिया)[\s!.,।]*$/i,
    reply: {
      en: "You're welcome. If another question comes up, ask it the same way — I keep the context in this conversation.",
      hi: "कोई बात नहीं। अगर कोई और सवाल हो तो इसी तरह पूछिए — बातचीत का संदर्भ बना रहता है।",
      "hi-Latn": "Koi baat nahi. Agar koi aur sawaal ho to isi tarah poochhiye — baatcheet ka sandarbh bana rehta hai.",
    },
  },
  {
    match: /^(bye|goodbye|good night|see you|ok bye|alvida|phir milenge|अलविदा|फिर मिलेंगे)[\s!.,।]*$/i,
    reply: {
      en: "Goodbye. Your conversations stay in this browser, so you can pick the thread up later without starting over.",
      hi: "अलविदा। आपकी बातचीत इसी ब्राउज़र में रहती है, इसलिए बाद में वहीं से शुरू कर सकते हैं।",
      "hi-Latn": "Alvida. Aapki baatcheet isi browser mein rehti hai, isliye baad mein wahin se shuru kar sakte hain.",
    },
  },
  {
    match:
      /^(who are you|what are you|tum kaun ho|aap kaun hain|tum kaun|your name|what is your name|naam kya hai|तुम कौन हो|आप कौन हैं|तुम्हारा नाम क्या है|आपका नाम क्या है)(?:\s+(?:exactly|really|please|then|ji))?[\s!.?।]*$/i,
    reply: {
      en: "I'm ANVIK — a personal AI named after anvikshiki, the classical discipline of examining what follows from what. I answer in the language you ask in, and I try to name the official source whenever the answer is about a form, a scheme or a law.",
      hi: "मैं ANVIK हूँ — अन्वीक्षिकी से नाम लिया गया है, यानी जो निष्कर्ष निकलता है उसे जाँचने का शास्त्र। मैं उसी भाषा में जवाब देता हूँ जिसमें आप पूछते हैं, और किसी फ़ॉर्म, योजना या कानून के सवाल पर आधिकारिक स्रोत का नाम बताता हूँ।",
      "hi-Latn": "Main ANVIK hoon — naam anvikshiki se aaya hai, matlab jo nateeja nikalta hai use jaanchne ka shastra. Main usi bhasha mein jawab deta hoon jismein aap poochhte hain, aur kisi form, yojana ya kanoon ke sawaal par adhikarik srot ka naam batata hoon.",
    },
  },
  {
    match:
      /^(what can you do|what do you do|help|kya kar sakte ho|kya kar sakte hain|tum kya kar sakte ho|features|तुम क्या कर सकते हो|आप क्या कर सकते हैं|मदद)(?:\s+(?:here|now|exactly|for me|please|today|ji)){0,2}[\s!.?।]*$/i,
    reply: {
      en: "Six things: answer a question and keep following up in Chat, make an image from a description, draft and explain code, take dictation, read an uploaded photo or form, and start from a ready-made prompt. History stays in this browser and the first three questions a day are free.",
      hi: "छह काम: चैट में सवाल का जवाब और आगे की बातचीत, वर्णन से तस्वीर बनाना, कोड लिखना और समझाना, बोलकर लिखवाना, अपलोड की गई तस्वीर या फ़ॉर्म पढ़ना, और तैयार प्रॉम्प्ट से शुरुआत। इतिहास इसी ब्राउज़र में रहता है और दिन के पहले तीन सवाल मुफ़्त हैं।",
      "hi-Latn": "Chhah kaam: chat mein sawaal ka jawab aur aage ki baatcheet, varnan se tasveer banana, code likhna aur samjhana, bolkar likhwana, upload ki gayi tasveer ya form padhna, aur taiyaar prompt se shuruaat. Itihaas isi browser mein rehta hai aur din ke pehle teen sawaal free hain.",
    },
  },
  {
    match: /^(ok|okay|k|hmm+|acha|accha|theek hai|thik hai|got it|sure|nice|cool|great|good|ठीक है|ठीक|अच्छा)[\s!.,।]*$/i,
    reply: {
      en: "Right. Whenever you're ready, put the next question in the same box — I'll keep the surrounding context.",
      hi: "ठीक है। जब भी तैयार हों, अगला सवाल उसी बॉक्स में लिखिए — आसपास का संदर्भ बना रहेगा।",
      "hi-Latn": "Theek hai. Jab bhi taiyaar hon, agla sawaal usi box mein likhiye — aas-paas ka sandarbh bana rahega.",
    },
  },
];

export type LocalAnswer = {
  reply: string;
  lang: Lang;
  /** which rule matched, for the UI badge */
  topic: string;
};

/**
 * Return a canned answer for a message that does not need a model at all.
 * Deliberately conservative: only whole-message greetings and thanks qualify,
 * so a real question is never accidentally answered by a template.
 */
const ROMAN_HINDI = /\b(namaste|namaskar|dhanyavad|dhanyawad|shukriya|alvida|theek|thik|acha|accha|kaun|kya|aap|tum|hai|hain|madad|phir)\b/i;

/**
 * Language for small talk. The detector needs two stopwords, but "Namaste" on
 * its own carries no English at all — answer in the script the person wrote in.
 */
function smallTalkLang(text: string): Lang {
  const deva = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  const letters = (text.match(/[a-zA-Z\u0900-\u097F]/g) ?? []).length;
  if (letters > 0 && deva / letters > 0.5) return "hi";
  if (ROMAN_HINDI.test(text)) return "hi-Latn";
  return detectLanguage(text);
}

export function localAnswer(message: string): LocalAnswer | null {
  const text = message.trim();
  if (!text || text.length > 80) return null;
  const lang = smallTalkLang(text);
  for (const rule of LOCAL_RULES) {
    if (rule.match.test(text)) {
      return { reply: rule.reply[lang], lang, topic: "small talk" };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 2. cache                                                           */
/* ------------------------------------------------------------------ */

/** Normalised key: case, punctuation and filler whitespace should not miss. */
export function cacheKey(message: string, lang?: Lang, mode?: string): string {
  const language = lang ?? detectLanguage(message);
  const normal = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return `${language}|${mode ?? "smart"}|${normal}`;
}

export type CacheEntry = {
  key: string;
  answer: string;
  lang: Lang;
  createdAt: number;
  hits: number;
};

export function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.createdAt < CACHE_TTL_MS && Boolean(entry.answer?.trim());
}

/** In-memory cache, used by the route (per process) and as a browser fallback. */
const memoryCache = new Map<string, CacheEntry>();

export function memoryGet(key: string, now = Date.now()): CacheEntry | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (!isFresh(entry, now)) {
    memoryCache.delete(key);
    return undefined;
  }
  entry.hits += 1;
  return entry;
}

export function memorySet(key: string, answer: string, lang: Lang): CacheEntry {
  const entry: CacheEntry = { key, answer, lang, createdAt: Date.now(), hits: 0 };
  memoryCache.set(key, entry);
  if (memoryCache.size > 300) {
    // drop the oldest third so a long-lived process stays bounded
    const oldest = [...memoryCache.values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, 100);
    for (const item of oldest) memoryCache.delete(item.key);
  }
  return entry;
}

export function memorySize(): number {
  return memoryCache.size;
}

/** Test seam. */
export function memoryClear(): void {
  memoryCache.clear();
}

/* ------------------------------------------------------------------ */
/* 3. corpus lookup (the credit-free fallback)                        */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "i", "my", "me",
  "to", "for", "of", "and", "in", "on", "at", "it", "this", "that", "what", "how",
  "can", "should", "would", "could", "please", "tell", "give", "about",
  "kya", "kaise", "hai", "hain", "ka", "ki", "ko", "se", "mein", "mujhe", "mera",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOPWORDS.has(word)),
  );
}

/**
 * Find a corpus answer that genuinely covers the question.
 * Threshold is high on purpose: a wrong confident answer is worse than a
 * model call, so anything below 0.7 falls through to the provider.
 */
export function corpusEntry(message: string, lang: Lang, threshold = 0.7): CorpusEntry | null {
  const asked = tokens(message);
  if (asked.size === 0) return null;
  let best: { entry: CorpusEntry; score: number } | null = null;

  for (const entry of CORPUS) {
    const variant = tokens(entry.questions[lang] ?? entry.questions.en);
    if (variant.size === 0) continue;
    let shared = 0;
    for (const token of asked) if (variant.has(token)) shared += 1;
    const score = shared / Math.max(asked.size, variant.size);
    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= threshold ? best.entry : null;
}

/** The reviewed answer for a question, or null when nothing matches closely. */
export function corpusAnswer(message: string, lang: Lang, threshold = 0.7): string | null {
  const entry = corpusEntry(message, lang, threshold);
  if (!entry) return null;
  return entry.answers[lang] ?? entry.answers.en ?? null;
}

/** Demo-mode fallback when the provider fails and nothing else matches. */
export function fallbackAnswer(lang: Lang): string {
  return FALLBACK[lang] ?? FALLBACK.en;
}

/* ------------------------------------------------------------------ */
/* 4. history summarisation — the token saver                          */
/* ------------------------------------------------------------------ */

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * Rough token count: ~4 characters per token for Latin, and Devanagari is
 * denser per character (the §7.1 factor used elsewhere in the product).
 */
export function estimateTokens(text: string): number {
  const deva = (text.match(/[ऀ-৿]/g) ?? []).length;
  const perChar = deva / Math.max(1, text.length) > 0.3 ? 0.61 : 0.28;
  return Math.ceil(text.length * perChar);
}

export function tokensOf(turns: Turn[]): number {
  return turns.reduce((sum, turn) => sum + estimateTokens(turn.content) + 4, 0);
}

export type PreparedHistory = {
  /** the messages actually sent to the model */
  messages: Turn[];
  /** a compact summary of everything older than the window */
  summary: string;
  /** how many turns were folded into the summary */
  summarised: number;
  tokensBefore: number;
  tokensAfter: number;
  savedPercent: number;
};

const SUMMARY_SOFT_CAP = 420;

/**
 * Send only the last `window` turns, plus a short summary of the rest.
 *
 * The summary is built by extraction, not by a model call: it keeps the user's
 * own earlier questions (which is what carries topic and intent) and the first
 * sentence of each earlier answer. That is free, deterministic, and enough for
 * continuity — paying a model to summarise would defeat the point.
 */
export function prepareHistory(turns: Turn[], window: number = HISTORY_WINDOW): PreparedHistory {
  const clean = turns.filter((turn) => turn.content.trim().length > 0);
  const tokensBefore = tokensOf(clean);
  if (clean.length <= window) {
    return {
      messages: clean,
      summary: "",
      summarised: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
      savedPercent: 0,
    };
  }

  const older = clean.slice(0, clean.length - window);
  const recent = clean.slice(clean.length - window);

  const askedEarlier = older
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.replace(/\s+/g, " ").trim().slice(0, 90));
  const answeredEarlier = older
    .filter((turn) => turn.role === "assistant")
    .map((turn) => {
      const first = turn.content.split(/(?<=[.!?।])\s/)[0] ?? turn.content;
      return first.replace(/\s+/g, " ").trim().slice(0, 90);
    });

  const parts: string[] = [];
  if (askedEarlier.length) {
    parts.push(`Earlier the user asked about: ${askedEarlier.slice(-6).join("; ")}.`);
  }
  if (answeredEarlier.length) {
    parts.push(`Earlier answers covered: ${answeredEarlier.slice(-4).join("; ")}.`);
  }
  let summary = parts.join(" ");
  if (summary.length > SUMMARY_SOFT_CAP) summary = `${summary.slice(0, SUMMARY_SOFT_CAP)}…`;

  const messages: Turn[] = summary
    ? [{ role: "user", content: `Conversation so far (summarised): ${summary}` }, ...recent]
    : recent;

  const tokensAfter = tokensOf(messages);
  const savedPercent = tokensBefore > 0 ? Math.max(0, Math.round((1 - tokensAfter / tokensBefore) * 100)) : 0;

  return { messages, summary, summarised: older.length, tokensBefore, tokensAfter, savedPercent };
}

/* ------------------------------------------------------------------ */
/* 5. pricing UI labels                                                */
/* ------------------------------------------------------------------ */

export function creditLabel(source: CreditSource): string {
  switch (source) {
    case "local":
      return "Answered on this device · 0 credits";
    case "cache":
      return "From memory · 0 credits used";
    case "learning":
      return "From what you taught ANVIK · 0 credits";
    case "corpus":
      return "From the reviewed answer set · 0 credits";
    default:
      return "Live model · low credit";
  }
}

/** True when a source never touches a paid model. */
export function isFreeSource(source: CreditSource): boolean {
  return source !== "model";
}

/* ------------------------------------------------------------------ */
/* 6. per-device usage (localStorage)                                  */
/* ------------------------------------------------------------------ */

export const USAGE_KEY = "anvik-usage";

export type Usage = {
  /** IST calendar day, "2026-11-21" */
  day: string;
  /** messages answered by a model — these are the ones the soft limit counts */
  chats: number;
  /** messages answered from cache, the corpus or on this device */
  free: number;
  total: number;
};

function istDay(at = Date.now()): string {
  // IST is UTC+5:30 and has no DST; shift then read the UTC date.
  return new Date(at + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const EMPTY_USAGE: Usage = { day: "", chats: 0, free: 0, total: 0 };

export function readUsage(now = Date.now()): Usage {
  const today = istDay(now);
  if (typeof window === "undefined") return { ...EMPTY_USAGE, day: today };
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return { ...EMPTY_USAGE, day: today };
    const parsed = JSON.parse(raw) as Partial<Usage>;
    if (parsed.day !== today) return { ...EMPTY_USAGE, day: today };
    return {
      day: today,
      chats: Number(parsed.chats) || 0,
      free: Number(parsed.free) || 0,
      total: Number(parsed.total) || 0,
    };
  } catch {
    return { ...EMPTY_USAGE, day: today };
  }
}

/** Count one message. Free sources never count against the daily limit. */
export function recordUsage(source: CreditSource, now = Date.now()): Usage {
  const current = readUsage(now);
  const next: Usage = {
    day: current.day,
    chats: current.chats + (isFreeSource(source) ? 0 : 1),
    free: current.free + (isFreeSource(source) ? 1 : 0),
    total: current.total + 1,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}

/** Share of today's answers that cost nothing, 0–100. */
export function freeShare(usage: Usage): number {
  return usage.total === 0 ? 0 : Math.round((usage.free / usage.total) * 100);
}

export function remainingChats(usage: Usage): number {
  return Math.max(0, SOFT_DAILY_LIMIT - usage.chats);
}
