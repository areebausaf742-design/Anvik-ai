import test from "node:test";
import assert from "node:assert/strict";
import {
  containsSecret,
  learningStats,
  memoryInstruction,
  normalizeQuestion,
  redact,
  topicsOf,
  type Feedback,
  type Learning,
} from "../lib/learning";

test("API keys never survive redaction", () => {
  const { text, removed } = redact("my key is AIzaSyD-abcdefghijklmnopqrstuvwxyz123456 ok?");
  assert.ok(!text.includes("AIza"));
  assert.ok(text.includes("[key removed]"));
  assert.deepEqual(removed, ["api key"]);
});

test("passwords written as key: value are stripped", () => {
  const { text } = redact("password: hunter2 and the username is ravi");
  assert.ok(!text.includes("hunter2"));
  assert.ok(text.includes("[removed]"));
  assert.ok(text.includes("ravi"), "a name is not a secret");
});

test("phone numbers and card numbers are removed", () => {
  const { text, removed } = redact("call me on 9876543210 or +91 91234 56789");
  assert.ok(!text.includes("9876543210"));
  assert.ok(!text.includes("91234"));
  assert.ok(text.includes("[phone removed]"));
  assert.ok(removed.includes("phone"));

  const card = redact("card 4111 1111 1111 1111 expiry 09/28");
  assert.ok(!card.text.includes("4111"));
});

test("an ordinary sentence is not mangled", () => {
  const clean = "How do I link my Aadhaar with my PAN on the income tax portal?";
  assert.equal(redact(clean).text, clean);
  assert.equal(containsSecret(clean), false);
  assert.equal(containsSecret("my password is abc123"), true);
});

test("normalisation makes the same question comparable across typing styles", () => {
  assert.equal(
    normalizeQuestion("How do I improve my CREDIT score??"),
    normalizeQuestion("how do i improve my credit score"),
  );
});

test("topics pick out the content words, not the grammar", () => {
  const topics = topicsOf("How do I improve my credit score?");
  assert.ok(topics.includes("credit"));
  assert.ok(topics.includes("improve"));
  assert.ok(!topics.includes("how"));
});

test("memory instruction is one line and only says what was set", () => {
  const instruction = memoryInstruction({ name: "Ravi", lang: "hi-Latn", style: "short", updatedAt: 1 });
  assert.match(instruction, /Ravi/);
  assert.match(instruction, /Hinglish/);
  assert.match(instruction, /short/i);
  assert.ok(instruction.split("\n").length === 1);

  const none = memoryInstruction({ name: "", lang: "en", style: "short", updatedAt: 0 });
  assert.ok(none.includes("short"));
});

test("dashboard counts likes, dislikes, corrections and top topics", () => {
  const feedback: Feedback[] = [
    { id: "1", question: "credit score kaise badhaye", answer: "a", verdict: "like", lang: "hi-Latn", topic: "credit", createdAt: 3 },
    { id: "2", question: "GST notice aaya hai", answer: "b", verdict: "like", lang: "hi-Latn", topic: "gst", createdAt: 2 },
    { id: "3", question: "credit score", answer: "c", verdict: "dislike", lang: "en", topic: "credit", createdAt: 1 },
  ];
  const learning: Learning = {
    feedback,
    corrections: [
      { id: "4", question: "credit score", answer: "c", correction: "say this instead", lang: "en", topic: "credit", createdAt: 1 },
    ],
    replays: 4,
    updatedAt: 1,
  };
  const stats = learningStats(learning);
  assert.equal(stats.likes, 2);
  assert.equal(stats.dislikes, 1);
  assert.equal(stats.corrections, 1);
  assert.equal(stats.replays, 4);
  assert.equal(stats.topTopics[0].topic, "credit");
  assert.equal(stats.topTopics[0].count, 3);
  assert.equal(stats.bestReplies.length, 2);
  assert.equal(stats.bestReplies[0].at, 3, "most recent like first");
});
