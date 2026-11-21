import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_MODELS,
  CHAT_MAX_TOKENS,
  CODE_MAX_TOKENS,
  LIMIT_REACHED,
  MAX_TEMPERATURE,
  SOFT_DAILY_LIMIT,
  isAllowedModel,
} from "../lib/credit";

/**
 * lib/credit.ts used to answer questions. These tests pin the replacement
 * contract: it holds limits and nothing else.
 */

test("only flash is callable, and Pro can never be configured in", () => {
  assert.deepEqual(ALLOWED_MODELS, ["gemini-2.0-flash"]);
  assert.equal(isAllowedModel("gemini-2.0-flash"), true);
  assert.equal(isAllowedModel("  GEMINI-2.0-FLASH "), true);
  assert.equal(isAllowedModel("gemini-2.5-pro"), false);
  assert.equal(isAllowedModel("gemini-1.5-pro"), false);
});

test("output and temperature ceilings are enforced as constants", () => {
  assert.equal(CHAT_MAX_TOKENS, 800);
  assert.equal(CODE_MAX_TOKENS, 1500);
  assert.ok(MAX_TEMPERATURE <= 0.7);
});

test("the daily ceiling says what it is and resets", () => {
  assert.equal(SOFT_DAILY_LIMIT, 100);
  assert.match(LIMIT_REACHED, /100/);
  assert.match(LIMIT_REACHED, /midnight IST/);
});

test("credit.ts exposes nothing that can produce an answer", async () => {
  const credit = (await import("../lib/credit")) as Record<string, unknown>;
  for (const name of [
    "localAnswer",
    "corpusAnswer",
    "cacheKey",
    "memoryGet",
    "memorySet",
    "prepareHistory",
    "creditLabel",
  ]) {
    assert.equal(credit[name], undefined, `${name} must not exist — it answered without the model`);
  }
});
