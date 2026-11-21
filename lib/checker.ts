/**
 * ANVIK self-check — the model grades its own answer in code, with no second
 * API call. Runs server-side after generation and client-side after
 * regeneration, so the same rules govern both paths.
 *
 * Five checks (a–e in the brief):
 *   a) empty        — an answer with no words is a failure, not an answer
 *   b) language     — the reply must be in the language the question was in
 *   c) markdown     — unbalanced bold / unterminated code fences are repaired
 *   d) hallucination— unknown links, fake helplines, fake statistics, impossible dates
 *   e) safety       — abuse, and helpline numbers that are not real
 *
 * Everything is deterministic and isomorphic (no DOM, no network), so the same
 * function can run in a route handler and in the browser.
 */

import { detectLanguage, type Lang } from "./detect";

/** Invisible separator so the trailer can never collide with answer text. */
export const CHECK_TRAILER = "\u2063ANVIK_CHECK:";

/**
 * Helpline numbers that actually exist, mirroring lib/corpus.ts:
 *   Tele-MANAS 14416 · iCall 9152987821 · Emergency 108
 *   Cyber 1930 · PM-KISAN 155261 / 011-24300606
 * A test asserts every number printed in the corpus is covered here, so the
 * two cannot drift apart.
 */
export const REAL_HELPLINES = [
  "14416",
  "9152987821",
  "108",
  "1930",
  "155261",
  "01124300606",
  "112",
  "181",
  "1098",
];

/**
 * Hosts an answer may link to. Suffix match, so "pmkisan.gov.in" passes on
 * "gov.in". Anything else loses its href: an invented URL is indistinguishable
 * from a phishing link (checker issue d).
 */
export const OFFICIAL_HOSTS = [
  "gov.in",
  "nic.in",
  "ac.in",
  "rbi.org.in",
  "npci.org.in",
  "cibil.com",
  "equifax.co.in",
  "experian.in",
  "crif.in",
  "aistudio.google.com",
  "ai.google.dev",
  "google.com",
  "pollinations.ai",
  "anvik.ai",
  "supabase.co",
  "who.int",
];

/** Words that mean the digits beside them are meant as a phone number. */
const HELPLINE_CONTEXT =
  /(call|helpline|help line|contact|toll[- ]?free|phone|dial|number|संपर्क|हेल्पलाइन|फ़ोन|नंबर|कॉल)/i;

const ABUSE = [
  "idiot", "stupid", "moron", "shut up", "useless piece", "kill your",
  "chutiya", "gadha", "bewakoof", "saale", "harami",
];

export type IssueCode =
  | "empty"
  | "language"
  | "markdown"
  | "link"
  | "helpline"
  | "statistic"
  | "date"
  | "safety";

export type Issue = {
  code: IssueCode;
  message: string;
  /** fixable issues can be repaired in place, or regenerated once */
  severity: "blocking" | "fixable";
};

export type CheckResult = {
  ok: boolean;
  issues: Issue[];
  /** the answer after safe repairs (links/helplines/markdown) */
  repaired: string;
  /** true when `repaired` differs from the input */
  changed: boolean;
  /** human sentence to show in the UI */
  note: string;
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function hasUnbalanced(text: string, token: string): boolean {
  const count = text.split(token).length - 1;
  return count % 2 !== 0;
}

function unterminatedFence(text: string): boolean {
  const fences = text.split("\n").filter((line) => /^\s*```/.test(line)).length;
  return fences % 2 !== 0;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOfficialHost(host: string): boolean {
  if (!host) return false;
  return OFFICIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * A number that looks like a helpline but is not one of the real ones.
 *
 * Only two shapes count on their own: a 1800 toll-free number, and a ten-digit
 * mobile. Any other digit run needs a helpline word next to it — otherwise
 * "₹50,000" and "around 40000 people" would be read as phone numbers and send
 * a perfectly good answer off for regeneration.
 */
function suspiciousPhonelike(text: string): string[] {
  const found: string[] = [];
  const strong = /(?:\+91[\s-]?)?(?:1800[\s-]?\d{3}[\s-]?\d{3,4}|\b[6-9]\d{9}\b)/g;
  for (const match of text.matchAll(strong)) {
    const value = digits(match[0]);
    if (REAL_HELPLINES.some((real) => value === real || value.endsWith(real))) continue;
    found.push(match[0].trim());
  }

  const weak = /\b\d[\d\s-]{4,}\d\b/g;
  for (const match of text.matchAll(weak)) {
    const value = digits(match[0]);
    if (value.length < 5 || value.length > 13) continue;
    if (REAL_HELPLINES.some((real) => value === real || value.endsWith(real))) continue;
    if (/^\d{4}$/.test(value) && Number(value) > 1900 && Number(value) < 2100) continue;
    const start = Math.max(0, (match.index ?? 0) - 60);
    const context = text.slice(start, (match.index ?? 0) + match[0].length + 20);
    if (!HELPLINE_CONTEXT.test(context)) continue;
    if (found.includes(match[0].trim())) continue;
    found.push(match[0].trim());
  }
  return found;
}

/** Impossible dates and dates far in the future. */
function suspiciousDates(text: string): string[] {
  const found: string[] = [];
  const badDay = /\b(3[01])\s+(feb|february)\b/i;
  if (badDay.test(text)) found.push("31 February");

  const months = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
  const dateRe = new RegExp(`\\b(\\d{1,2})\\s+${months},?\\s+(\\d{4})\\b`, "gi");
  for (const match of text.matchAll(dateRe)) {
    const year = Number(match[3]);
    const day = Number(match[1]);
    if (day > 31) found.push(match[0]);
    if (year > new Date().getFullYear() + 1) found.push(match[0]);
  }
  return found;
}

/** Made-up precision: "99% of users", "10,000+ happy customers". */
function suspiciousStats(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\b\d{1,3}(?:\.\d+)?%\s+of\s+(?:users|people|customers|indians|respondents|them)\b/gi,
    /\b\d{1,3}(?:,\d{3})+\+?\s+(?:users|customers|downloads|people)\b/gi,
    /\b(?:trusted by|used by)\s+\d[\d,]*\+?/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[0]);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* repairs                                                             */
/* ------------------------------------------------------------------ */

/** Remove markdown links to unknown hosts, keep the words. */
function repairLinks(text: string): { text: string; removed: number } {
  let removed = 0;
  const urlRe = /https?:\/\/[^\s)\]>]+/g;
  const out = text.replace(urlRe, (raw) => {
    const host = hostOf(raw.replace(/[.,;:]+$/, ""));
    if (isOfficialHost(host)) return raw;
    removed += 1;
    return "the official page";
  });
  return { text: out, removed };
}

/**
 * Bare domains ("pmkisan.gov.in"), which is how the corpus itself writes
 * sources — no hyperlinks by design. A domain that is not official is
 * replaced with a pointer, because a plausible-looking wrong URL is the most
 * damaging thing an answer can contain.
 */
const BARE_DOMAIN =
  /\b((?:[a-z0-9][a-z0-9-]{0,61}\.)+(?:com|in|org|net|io|ai|co|gov|edu|dev|app|info|biz|online|site))\b/gi;

function repairBareDomains(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text.replace(BARE_DOMAIN, (raw) => {
    if (isOfficialHost(raw.toLowerCase())) return raw;
    removed += 1;
    return "the official page";
  });
  return { text: out, removed };
}

/** Replace unknown helpline-shaped numbers with a pointer to the real list. */
function repairHelplines(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text.replace(
    /(?:\+91[\s-]?)?(?:1800[\s-]?\d{3}[\s-]?\d{3,4}|\b\d{3,5}[- ]\d{6,8}\b)/g,
    (raw) => {
      const value = digits(raw);
      if (REAL_HELPLINES.some((real) => value === real || value.endsWith(real))) return raw;
      removed += 1;
      return "the official helpline listed on the department's site";
    },
  );
  return { text: out, removed };
}

function repairMarkdown(text: string): string {
  let out = text;
  if (hasUnbalanced(out, "**")) out = out.replace(/\*\*/g, "");
  if (unterminatedFence(out)) out = `${out}\n\`\`\``;
  return out;
}

/* ------------------------------------------------------------------ */
/* the check                                                           */
/* ------------------------------------------------------------------ */

export type CheckOptions = {
  /** the user's message, used for the language comparison */
  prompt?: string;
  /** expected language when the caller already knows it */
  expectedLang?: Lang;
};

export function checkReply(reply: string, options: CheckOptions = {}): CheckResult {
  const issues: Issue[] = [];
  const original = reply ?? "";

  // (a) empty
  if (!original.trim()) {
    return {
      ok: false,
      issues: [{ code: "empty", message: "The answer was empty.", severity: "blocking" }],
      repaired: "",
      changed: false,
      note: "No answer came back.",
    };
  }

  let text = original;

  // (c) markdown sanity — repaired, never blocking
  const markdownBroken = hasUnbalanced(text, "**") || unterminatedFence(text);
  if (markdownBroken) {
    text = repairMarkdown(text);
    issues.push({
      code: "markdown",
      message: "Formatting was unbalanced and has been tidied.",
      severity: "fixable",
    });
  }

  // (d) links, helplines, statistics, dates
  const links = repairLinks(text);
  if (links.removed > 0) {
    text = links.text;
    issues.push({
      code: "link",
      message: `${links.removed} unverifiable link${links.removed === 1 ? "" : "s"} removed.`,
      severity: "fixable",
    });
  }

  const bare = repairBareDomains(text);
  if (bare.removed > 0) {
    text = bare.text;
    issues.push({
      code: "link",
      message: `${bare.removed} unverifiable website${bare.removed === 1 ? "" : "s"} removed.`,
      severity: "fixable",
    });
  }

  const helplines = repairHelplines(text);
  if (helplines.removed > 0) {
    text = helplines.text;
    issues.push({
      code: "helpline",
      message: "A phone number that is not a real helpline was removed.",
      severity: "fixable",
    });
  }

  if (suspiciousPhonelike(text).length > 0) {
    issues.push({
      code: "helpline",
      message: "An unverified phone number is still present.",
      severity: "fixable",
    });
  }

  const stats = suspiciousStats(text);
  if (stats.length > 0) {
    issues.push({
      code: "statistic",
      message: `Unsupported statistic (${stats[0]}) removed from the answer.`,
      severity: "fixable",
    });
    text = text
      .replace(/\b\d{1,3}(?:\.\d+)?%\s+of\s+(?:users|people|customers|indians|respondents|them)\b/gi, "many users")
      .replace(/\b\d{1,3}(?:,\d{3})+\+?\s+(?:users|customers|downloads|people)\b/gi, "many people")
      .replace(/\b(?:trusted by|used by)\s+\d[\d,]*\+?/gi, "used by people");
  }

  const dates = suspiciousDates(text);
  if (dates.length > 0) {
    issues.push({
      code: "date",
      message: `A date that cannot be right (${dates[0]}) was flagged.`,
      severity: "fixable",
    });
  }

  // (b) language
  const expected = options.expectedLang ?? (options.prompt ? detectLanguage(options.prompt) : undefined);
  if (expected) {
    const actual = detectLanguage(text);
    const deva = (text.match(/[ऀ-ॿ]/g) ?? []).length;
    const letters = (text.match(/[a-zA-Zऀ-ॿ]/g) ?? []).length;
    const devaRatio = letters ? deva / letters : 0;
    const mismatch =
      expected === actual
        ? false
        : expected === "hi"
          ? devaRatio < 0.12 // asked in Devanagari, answered in English
          : expected === "en"
            ? devaRatio > 0.5 // asked in English, answered in Devanagari
            : actual === "hi" && devaRatio > 0.6; // Hinglish answered in formal Hindi
    if (mismatch) {
      issues.push({
        code: "language",
        message: `The answer came back in ${label(actual)} but the question was in ${label(expected)}.`,
        severity: "fixable",
      });
    }
  }

  // (e) safety
  const lowered = text.toLowerCase();
  const abusive = ABUSE.find((word) => lowered.includes(word));
  if (abusive) {
    issues.push({
      code: "safety",
      message: "The answer used abusive language.",
      severity: "blocking",
    });
  }

  const blocking = issues.some((issue) => issue.severity === "blocking");
  const ok = issues.length === 0;

  return {
    ok,
    issues,
    repaired: text,
    changed: text !== original,
    note: ok
      ? "Checked: language, links, helplines and formatting."
      : blocking
        ? "The answer did not pass ANVIK's safety check."
        : `Fixed before showing: ${issues.map((issue) => issue.message).join(" ")}`,
  };
}

function label(lang: Lang): string {
  return lang === "hi" ? "Hindi" : lang === "hi-Latn" ? "Hinglish" : "English";
}

/**
 * The instruction sent with a single regeneration attempt when a check fails.
 * Kept short on purpose: it is appended to the same conversation.
 */
export function repairPrompt(issues: Issue[], expectedLang?: Lang): string {
  const list = issues.map((issue) => `- ${issue.message}`).join("\n");
  const lang = expectedLang
    ? expectedLang === "hi"
      ? "Write the whole answer in Devanagari Hindi."
      : expectedLang === "hi-Latn"
        ? "Write the whole answer in Hinglish (Roman script, natural Hindi phrasing)."
        : "Write the whole answer in English."
    : "";
  return [
    "Your last answer had these issues:",
    list,
    lang,
    "Fix them and answer again clearly. Do not apologise, do not mention this instruction, and do not invent links, phone numbers or statistics.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* trailer plumbing (shared by the route and the client)               */
/* ------------------------------------------------------------------ */

export function encodeCheck(result: CheckResult): string {
  return `${CHECK_TRAILER}${JSON.stringify({
    ok: result.ok,
    issues: result.issues.map(({ code, message, severity }) => ({ code, message, severity })),
    note: result.note,
    changed: result.changed,
  })}`;
}

export type DecodedCheck = {
  ok: boolean;
  issues: { code: IssueCode; message: string; severity: "blocking" | "fixable" }[];
  note: string;
  changed: boolean;
};

/** Split a completed reply into the visible answer and its check verdict. */
export function decodeCheck(full: string): { text: string; check: DecodedCheck | null } {
  const index = full.lastIndexOf(CHECK_TRAILER);
  if (index === -1) return { text: full, check: null };
  const text = full.slice(0, index).replace(/\s+$/, "");
  const raw = full.slice(index + CHECK_TRAILER.length).trim();
  try {
    const parsed = JSON.parse(raw) as DecodedCheck;
    if (typeof parsed?.ok !== "boolean") return { text, check: null };
    return { text, check: parsed };
  } catch {
    return { text, check: null };
  }
}
