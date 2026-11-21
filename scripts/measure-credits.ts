/**
 * Credit and token measurement — the numbers the Phase 3 brief asks for.
 *
 *   npm run measure
 *
 * Two questions, answered from the real functions rather than from estimates:
 *   1. What share of a realistic session is answered at zero credits?
 *   2. How much of the prompt does history summarisation actually remove?
 *
 * Every message below runs through the same functions /api/chat uses, in the
 * same order: local answer → cache → corpus → model.
 */

import { detectLanguage } from "../lib/detect";
import {
  cacheKey,
  corpusAnswer,
  estimateTokens,
  localAnswer,
  memoryClear,
  memoryGet,
  memorySet,
  prepareHistory,
  tokensOf,
  type Turn,
} from "../lib/credit";
import { CORPUS } from "../lib/corpus";

/* ------------------------------------------------------------------ */
/* 1. zero-credit share over a day of 40 prompts                       */
/* ------------------------------------------------------------------ */

type Case = { prompt: string; repeatOf?: string };

const DAY: Case[] = [
  // small talk — the highest-volume category in real chat logs
  { prompt: "hii" },
  { prompt: "hello" },
  { prompt: "hey" },
  { prompt: "namaste" },
  { prompt: "Namaste" },
  { prompt: "thanks" },
  { prompt: "thank you" },
  { prompt: "shukriya" },
  { prompt: "bye" },
  { prompt: "ok" },
  { prompt: "who are you" },
  { prompt: "what can you do" },
  // reviewed corpus questions, then the same ones again in a different phrasing
  { prompt: "How do I improve my credit score?" },
  { prompt: "My PM-KISAN instalment has not arrived. What should I do?" },
  { prompt: "I received a GST notice. What should I do?" },
  { prompt: "How do I link my Aadhaar with my PAN?" },
  { prompt: "I have been defrauded online. How can I get my money back?" },
  { prompt: "What is the eligibility for PM Awas Yojana?" },
  { prompt: "How do I improve my credit score?" },
  { prompt: "how do i improve my credit score" },
  { prompt: "How do I improve my CREDIT score?" },
  { prompt: "My PM-KISAN instalment has not arrived. What should I do?" },
  { prompt: "I received a GST notice. What should I do?" },
  // free-form questions: first time costs, the repeat does not
  { prompt: "Write a short leave application to my school principal" },
  { prompt: "Explain what a mutual fund expense ratio means" },
  { prompt: "Draft a WhatsApp message asking my landlord to fix the tap" },
  { prompt: "write code to reverse a string in JavaScript" },
  { prompt: "How do I file an RTI application in Uttar Pradesh?" },
  { prompt: "What documents do I need for a new SIM card?" },
  { prompt: "Explain the difference between a cheque and a demand draft" },
  { prompt: "Give me a weekly study plan for class 12 physics" },
  // the same free-form questions asked again later in the day
  { prompt: "Write a short leave application to my school principal" },
  { prompt: "Explain what a mutual fund expense ratio means" },
  { prompt: "Draft a WhatsApp message asking my landlord to fix the tap" },
  { prompt: "write code to reverse a string in JavaScript" },
  { prompt: "How do I file an RTI application in Uttar Pradesh?" },
  { prompt: "What documents do I need for a new SIM card?" },
  { prompt: "Explain the difference between a cheque and a demand draft" },
  { prompt: "Give me a weekly study plan for class 12 physics" },
  // a few new ones that must cost a call
  { prompt: "Summarise the process for transferring a vehicle registration" },
  { prompt: "Write a polite email declining a job offer" },
];

function measureZeroCredit() {
  memoryClear();
  const answers = new Map<string, string>();
  const tally = { local: 0, cache: 0, corpus: 0, model: 0 };
  const rows: string[] = [];

  for (const item of DAY) {
    const lang = detectLanguage(item.prompt);
    const mode = "smart";
    const key = cacheKey(item.prompt, lang, mode);

    let source: keyof typeof tally;
    if (localAnswer(item.prompt)) source = "local";
    else if (memoryGet(key)) source = "cache";
    else if (corpusAnswer(item.prompt, lang, 0.8)) source = "corpus";
    else source = "model";

    tally[source] += 1;

    // A model answer is cached (as in the route) and remembered so the repeat
    // is measured honestly rather than being a second call.
    if (source === "model") {
      const generated = answers.get(item.prompt) ?? `GENERATED_ANSWER ${item.prompt} `.repeat(6);
      answers.set(item.prompt, generated);
      memorySet(key, generated, lang);
    }
    // The route caches a corpus hit too, so the same question is a cache read
    // rather than a corpus scan next time. Match that here.
    if (source === "corpus") memorySet(key, CORPUS[0].answers[lang], lang);

    rows.push(`${source.padEnd(6)} ${JSON.stringify(item.prompt)}`);
  }

  const total = DAY.length;
  const free = tally.local + tally.cache + tally.corpus;
  return { total, tally, free, percent: Math.round((free / total) * 100), rows };
}

/** The same day with every prompt typed only once: the worst case. */
function measureUniqueOnly() {
  memoryClear();
  const seen = new Set<string>();
  const tally = { local: 0, cache: 0, corpus: 0, model: 0 };
  for (const item of DAY) {
    const normalized = item.prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const lang = detectLanguage(item.prompt);
    const key = cacheKey(item.prompt, lang, "smart");
    if (localAnswer(item.prompt)) tally.local += 1;
    else if (memoryGet(key)) tally.cache += 1;
    else if (corpusAnswer(item.prompt, lang, 0.8)) {
      tally.corpus += 1;
      memorySet(key, CORPUS[0].answers[lang], lang);
    } else {
      tally.model += 1;
      memorySet(key, "GENERATED_ANSWER", lang);
    }
  }
  const total = tally.local + tally.cache + tally.corpus + tally.model;
  const free = tally.local + tally.cache + tally.corpus;
  return { total, tally, free, percent: Math.round((free / total) * 100) };
}

/* ------------------------------------------------------------------ */
/* 2. token saving from history summarisation                          */
/* ------------------------------------------------------------------ */

function conversation(turns: number): Turn[] {
  const out: Turn[] = [];
  for (let i = 1; i <= turns; i += 1) {
    out.push({
      role: "user",
      content:
        `Question ${i}: I received a GST notice for a return filed in ${2019 + (i % 5)} and I do not ` +
        `understand what the reference number means. My accountant says it is a mismatch. What should I do?`,
    });
    out.push({
      role: "assistant",
      content:
        "Start with the notice type and the reference number, then check the return it points to. " +
        "If the mismatch is in turnover, the usual route is to reply on the portal with the reconciliation " +
        "sheet and the challan copies, and to keep every acknowledgement. ".repeat(3),
    });
  }
  return out;
}

function measureTokens() {
  const rows: { turns: number; before: number; after: number; saved: number; summarised: number }[] = [];
  for (const turns of [3, 6, 10, 20, 40, 80]) {
    const prepared = prepareHistory(conversation(turns));
    rows.push({
      turns: turns * 2,
      before: prepared.tokensBefore,
      after: prepared.tokensAfter,
      saved: prepared.savedPercent,
      summarised: prepared.summarised,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */

const zero = measureZeroCredit();

console.log(`=== Zero-credit share (${zero.total} prompts, one device, one day) ===\n`);
for (const row of zero.rows) if (!row.startsWith("model")) console.log(`  ${row}`);
console.log(`\n  local answers : ${zero.tally.local}`);
console.log(`  cache replays : ${zero.tally.cache}`);
console.log(`  corpus answers: ${zero.tally.corpus}`);
console.log(`  model calls   : ${zero.tally.model}`);
console.log(`  ZERO-CREDIT   : ${zero.free}/${zero.total} = ${zero.percent}%`);

const unique = measureUniqueOnly();
console.log(
  `\n  Lower bound, no repeats (${unique.total} unique prompts): ${unique.free}/${unique.total} = ${unique.percent}% free ` +
    `(${unique.tally.local} local, ${unique.tally.corpus} corpus, ${unique.tally.model} model).`,
);

console.log("\n=== History summarisation (prompt tokens sent per turn) ===\n");
console.log("  messages   before   after   saved   folded");
for (const row of measureTokens()) {
  console.log(
    `  ${String(row.turns).padStart(8)}  ${String(row.before).padStart(7)}  ${String(row.after).padStart(6)}  ${String(
      row.saved,
    ).padStart(5)}%  ${String(row.summarised).padStart(6)}`,
  );
}

const forty = prepareHistory(conversation(20)); // 20 exchanges = 40 messages
console.log(
  `\n  A 40-message conversation sends ${forty.tokensAfter} tokens instead of ${forty.tokensBefore} ` +
    `(${forty.savedPercent}% less), with ${forty.summarised} messages folded into one summary line.`,
);
const baseline = tokensOf(conversation(20));
console.log(`  Direct check: tokensOf(40 messages) = ${baseline}`);
console.log(`  Chat ceiling: 800 output tokens; code ceiling: 1,500; temperature cap 0.7.`);
console.log(`  Corpus entries available offline: ${CORPUS.length}.`);
console.log(`  Estimate check: ${estimateTokens("a plain English sentence")} tokens for 25 characters.`);
