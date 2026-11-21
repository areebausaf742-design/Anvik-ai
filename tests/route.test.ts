import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural guards. "what is car?" was once answered from the reviewed corpus
 * with a confident "0 credits" badge; these tests fail if that layer is ever
 * wired back in, even by an import that nothing currently calls.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const route = readFileSync(join(root, "app/api/chat/route.ts"), "utf8");
const workspace = readFileSync(join(root, "components/anvik/chat-workspace.tsx"), "utf8");

const ANSWER_SOURCES = [
  "localAnswer",
  "corpusAnswer",
  "corpusEntry",
  "memoryGet",
  "cacheKey",
  "prepareHistory",
  "findReplay",
  "saveAnswer",
  "demoReply",
  "streamCorpus",
  "fallbackAnswer",
];

test("the chat route has no shortcut that can answer without the model", () => {
  for (const name of ANSWER_SOURCES) {
    assert.ok(!route.includes(name), `${name} must not appear in app/api/chat/route.ts`);
  }
});

test("the chat route never imports the corpus", () => {
  assert.ok(!/from\s+["']@\/lib\/corpus/.test(route), "the corpus must not be reachable from chat");
  // credit.ts is still imported, but only for token/temperature ceilings.
  const imports = [...route.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']@\/lib\/credit["']/g)];
  for (const [, names] of imports) {
    const allowed = ["CHAT_MAX_TOKENS", "CODE_MAX_TOKENS", "MAX_TEMPERATURE"];
    for (const name of names.split(",").map((n) => n.trim()).filter(Boolean)) {
      assert.ok(allowed.includes(name), `${name} from lib/credit must not be used in chat`);
    }
  }
});

test("the chat route sends the whole conversation, with no summarised stand-in", () => {
  assert.ok(route.includes("generate(safeMessages)"), "Gemini must receive the real messages");
});

test("the route reads textStream, not the lazy result object", () => {
  // streamText() returns a lazy result with no reader; passing it straight to
  // the buffer made every live answer look like a rejected key.
  assert.ok(route.includes(".textStream"), "readAnswer must be given result.textStream");
  assert.ok(!/readAnswer\(\s*generate\([^)]*\)\s*\)/.test(route), "never pass the result object itself");
});

test("the client cannot replay an answer from memory", () => {
  assert.ok(!workspace.includes("findReplay"), "no replay path in the composer");
  assert.ok(!workspace.includes("saveAnswer"), "nothing is written to an answer cache");
  assert.ok(!workspace.includes("localAnswer"), "no local answer path");
});

test("no credit or unlimited wording survives in the interface", () => {
  for (const phrase of [
    "0 credits",
    "From memory",
    "reviewed answer set",
    "Unlimited with",
    "Saving credits",
    "Smart Mode ON",
  ]) {
    assert.ok(!workspace.includes(phrase), `"${phrase}" must be gone from the chat UI`);
  }
  assert.ok(workspace.includes("Powered by Gemini"), "the sidebar and composer must say where answers come from");
});
