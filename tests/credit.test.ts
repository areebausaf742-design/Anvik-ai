import test from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_TTL_MS,
  CHAT_MAX_TOKENS,
  HISTORY_WINDOW,
  MAX_TEMPERATURE,
  cacheKey,
  corpusAnswer,
  creditLabel,
  estimateTokens,
  fallbackAnswer,
  isFreeSource,
  localAnswer,
  memoryClear,
  memoryGet,
  memorySet,
  memorySize,
  prepareHistory,
  type Turn,
} from "../lib/credit";
import { CORPUS } from "../lib/corpus";

test("greetings are answered locally, in the language they were asked in", () => {
  assert.ok(localAnswer("hii")?.reply.includes("What would you like"));
  const namaste = localAnswer("Namaste");
  assert.equal(namaste?.lang, "hi-Latn", "Latin-script Namaste is Hinglish");
  assert.ok(namaste?.reply.startsWith("Namaste."));
  assert.ok(localAnswer("नमस्ते")?.reply.includes("नमस्ते"));
  assert.ok(localAnswer("thanks")?.reply.includes("welcome"));
  assert.ok(localAnswer("who are you")?.reply.includes("ANVIK"));
  assert.ok(localAnswer("what can you do")?.reply.includes("Six things"));
  assert.ok(localAnswer("bye")?.reply.includes("Goodbye"));
});

test("a real question is never swallowed by the small-talk rules", () => {
  assert.equal(localAnswer("hi, how do I link PAN with Aadhaar?"), null);
  assert.equal(localAnswer("what can you do about a blocked bank account?"), null);
  assert.equal(localAnswer("hello, my PM-KISAN instalment has not arrived"), null);
});

test("a corpus question matches its reviewed answer", () => {
  const answer = corpusAnswer("How do I improve my credit score?", "en", 0.8);
  assert.ok(answer && answer.length > 100);
  assert.ok(answer.includes("30%"));
});

test("an unrelated question does not get a corpus answer", () => {
  assert.equal(corpusAnswer("write me a poem about the monsoon", "en", 0.8), null);
  assert.equal(corpusAnswer("what is the airspeed velocity of a swallow", "en", 0.8), null);
});

test("every corpus answer is returned in the asked language", () => {
  for (const entry of CORPUS) {
    const answer = corpusAnswer(entry.questions.hi, "hi", 0.8);
    if (answer) assert.ok(answer.includes("।"), "Hindi answers end sentences with a danda");
  }
});

test("cache keys ignore case, punctuation and filler spacing", () => {
  const a = cacheKey("How do I improve my credit score?", "en", "smart");
  const b = cacheKey("  how do i   improve my CREDIT score  ", "en", "smart");
  assert.equal(a, b);
  assert.notEqual(a, cacheKey("How do I improve my credit score?", "en", "coder"));
});

test("cache entries expire after seven days", () => {
  memoryClear();
  const key = cacheKey("what is a credit score", "en", "smart");
  const entry = memorySet(key, "A credit score is a three-digit summary of borrowing behaviour.", "en");
  assert.ok(memoryGet(key));
  assert.equal(entry.hits >= 1, true);
  // simulate the clock moving past the TTL
  const stale = { ...entry, createdAt: Date.now() - CACHE_TTL_MS - 1000 };
  memoryClear();
  memorySet(key, stale.answer, "en");
  const stored = memoryGet(key);
  assert.ok(stored, "fresh entry is readable");
  memoryClear();
  assert.equal(memorySize(), 0);
});

test("history keeps the last six turns and summarises the older ones", () => {
  const turns: Turn[] = [];
  for (let i = 0; i < 20; i += 1) {
    turns.push({ role: "user", content: `Question number ${i} about a GST notice and the reply process` });
    turns.push({
      role: "assistant",
      content: `Answer ${i}. Open the portal, check the reference number, and reply within the stated window. ${"Detail. ".repeat(20)}`,
    });
  }
  const prepared = prepareHistory(turns);
  assert.equal(prepared.messages.length, HISTORY_WINDOW + 1); // summary + window
  assert.equal(prepared.messages[0].role, "user");
  assert.match(prepared.messages[0].content, /summarised/);
  assert.equal(prepared.messages.at(-1)?.content, turns.at(-1)?.content);
  assert.equal(prepared.summarised, turns.length - HISTORY_WINDOW);
  assert.ok(prepared.savedPercent > 60, `expected a large cut, got ${prepared.savedPercent}%`);
  assert.ok(prepared.tokensAfter < prepared.tokensBefore);
});

test("a short conversation is sent as-is, with no summary overhead", () => {
  const turns: Turn[] = [
    { role: "user", content: "How do I link PAN with Aadhaar?" },
    { role: "assistant", content: "Use the income tax portal, free of charge." },
    { role: "user", content: "Is there a fee?" },
  ];
  const prepared = prepareHistory(turns);
  assert.equal(prepared.messages.length, 3);
  assert.equal(prepared.summary, "");
  assert.equal(prepared.savedPercent, 0);
});

test("token estimate is language-aware and monotonic", () => {
  const english = estimateTokens("This is a plain English sentence about a form.");
  const hindi = estimateTokens("यह एक सरल हिंदी वाक्य है जो एक फ़ॉर्म के बारे में है।");
  assert.ok(english > 0 && hindi > 0);
  assert.ok(estimateTokens("x".repeat(400)) > estimateTokens("x".repeat(200)));
});

test("credit labels and free-source rules are honest about cost", () => {
  assert.equal(creditLabel("cache"), "From memory · 0 credits used");
  assert.equal(creditLabel("local"), "Answered on this device · 0 credits");
  assert.equal(creditLabel("model"), "Live model · low credit");
  for (const source of ["local", "cache", "learning", "corpus"] as const) {
    assert.equal(isFreeSource(source), true, `${source} must not count against the limit`);
  }
  assert.equal(isFreeSource("model"), false);
});

test("the cheap-model ceilings are enforced as constants", () => {
  assert.equal(CHAT_MAX_TOKENS, 800);
  assert.ok(MAX_TEMPERATURE <= 0.7);
  assert.ok(fallbackAnswer("hi").length > 20);
});
