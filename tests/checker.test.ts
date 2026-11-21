import test from "node:test";
import assert from "node:assert/strict";
import { CORPUS, SELFHARM_RESPONSE } from "../lib/corpus";
import { REAL_HELPLINES, checkReply, decodeCheck, encodeCheck, repairPrompt } from "../lib/checker";
import { detectLanguage } from "../lib/detect";

test("every helpline printed in the corpus is in the allowlist", () => {
  const text = [
    ...CORPUS.flatMap((entry) => Object.values(entry.answers)),
    ...Object.values(SELFHARM_RESPONSE),
  ].join("\n");
  const found = new Set<string>();
  for (const match of text.matchAll(/\d[\d\s-]{4,}\d/g)) {
    const value = match[0].replace(/\D/g, "");
    if (value.length >= 3) found.add(value);
  }
  const helplines = [...found].filter((value) => REAL_HELPLINES.some((real) => value.endsWith(real)));
  assert.ok(helplines.length >= 3, "the corpus should mention real helplines");
  for (const value of helplines) {
    assert.ok(
      REAL_HELPLINES.some((real) => value === real || value.endsWith(real)),
      `${value} is printed in the corpus but not in REAL_HELPLINES`,
    );
  }
});

test("an empty answer fails the check instead of passing silently", () => {
  const result = checkReply("   ");
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "empty");
  assert.equal(result.note, "No answer came back.");
});

test("a clean answer passes and is left untouched", () => {
  const answer =
    "Link your PAN to Aadhaar on the income tax portal. The step is free and takes about five minutes.\n\n1. Open incometax.gov.in\n2. Choose Link Aadhaar\n3. Enter the 12-digit number and verify the OTP";
  const result = checkReply(answer, { prompt: "How do I link my Aadhaar with my PAN?" });
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.equal(result.repaired, answer);
});

test("a made-up helpline is removed and replaced with a pointer", () => {
  const result = checkReply("Call 1800-999-8888 to reach the officer.", { prompt: "GST notice aaya hai" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "helpline"));
  assert.ok(!result.repaired.includes("1800"));
  assert.match(result.repaired, /official helpline/);
});

test("real helplines from the corpus survive the check", () => {
  const result = checkReply("For help call 14416 or 108. PM-KISAN: 155261.", { prompt: "kisan samman nidhi" });
  assert.ok(result.repaired.includes("14416"));
  assert.ok(result.repaired.includes("155261"));
  assert.ok(!result.issues.some((issue) => issue.code === "helpline" && issue.message.includes("removed")));
});

test("unknown links lose their href but keep the sentence", () => {
  const result = checkReply("Read more at https://fake-scheme-portal.example/apply today.", {
    prompt: "How do I apply for PM Awas Yojana?",
  });
  assert.ok(result.issues.some((issue) => issue.code === "link"));
  assert.ok(!result.repaired.includes("fake-scheme-portal"));
});

test("official links are kept", () => {
  const answer = "The form is on https://pmkisan.gov.in and the docs are at ai.google.dev.";
  const result = checkReply(answer, { prompt: "where is the form" });
  assert.ok(result.repaired.includes("pmkisan.gov.in"));
  assert.ok(result.repaired.includes("ai.google.dev"));
});

test("unbalanced bold is repaired rather than shown as asterisks", () => {
  const result = checkReply("This is **important and never closed.", { prompt: "explain this" });
  assert.ok(result.issues.some((issue) => issue.code === "markdown"));
  assert.equal(result.repaired, "This is important and never closed.");
});

test("an unterminated code fence is closed", () => {
  const result = checkReply("Here:\n```js\nconst a = 1;\n", { prompt: "write code" });
  assert.ok(result.issues.some((issue) => issue.code === "markdown"));
  assert.ok(result.repaired.trimEnd().endsWith("```"));
});

test("a Hindi question answered in English is flagged", () => {
  const result = checkReply("To improve your credit score, pay every bill on time.", {
    prompt: "क्रेडिट स्कोर कैसे बढ़ाएं?",
  });
  assert.ok(result.issues.some((issue) => issue.code === "language"));
  assert.equal(detectLanguage("क्रेडिट स्कोर कैसे बढ़ाएं?"), "hi");
});

test("a Hindi question answered in Hindi passes the language check", () => {
  const result = checkReply("क्रेडिट स्कोर समय पर भुगतान करने से बढ़ता है।", {
    prompt: "क्रेडिट स्कोर कैसे बढ़ाएं?",
  });
  assert.ok(!result.issues.some((issue) => issue.code === "language"));
});

test("invented statistics are softened", () => {
  const result = checkReply("98% of users improved their score in 3 days and 12,000+ customers agree.", {
    prompt: "does this work",
  });
  assert.ok(result.issues.some((issue) => issue.code === "statistic"));
  assert.ok(!result.repaired.includes("98%"));
  assert.ok(!result.repaired.includes("12,000+"));
});

test("impossible dates are reported", () => {
  const result = checkReply("The deadline is 31 February 2027.", { prompt: "when is the deadline" });
  assert.ok(result.issues.some((issue) => issue.code === "date"));
});

test("money amounts and counts are not mistaken for phone numbers", () => {
  const answer =
    "On a ₹50,000 limit, keep the monthly spend under 15000 rupees. Around 40000 applications arrive each month, and the fee is 1200.";
  const result = checkReply(answer, { prompt: "how much should I spend on my card" });
  assert.ok(!result.issues.some((issue) => issue.code === "helpline"), JSON.stringify(result.issues));
});

test("a ten-digit mobile offered as a helpline is still caught", () => {
  const result = checkReply("Call 9812345678 for the district office.", { prompt: "who do I call" });
  assert.ok(result.issues.some((issue) => issue.code === "helpline"));
});

test("real official domains survive, invented ones do not", () => {
  const answer = "See rbi.org.in for the circular and pmkisan-apply.online for the form.";
  const result = checkReply(answer, { prompt: "where is the circular" });
  assert.ok(result.repaired.includes("rbi.org.in"), "an official source is kept as plain text");
  assert.ok(!result.repaired.includes("pmkisan-apply.online"), "an invented domain is removed");
  assert.ok(result.repaired.includes("the official page"));
});

test("abuse is a blocking failure", () => {
  const result = checkReply("You are an idiot for asking that.", { prompt: "help" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "safety" && issue.severity === "blocking"));
});

test("the repair prompt names the issue and the language", () => {
  const prompt = repairPrompt([{ code: "language", message: "Wrong language.", severity: "fixable" }], "hi");
  assert.match(prompt, /Wrong language\./);
  assert.match(prompt, /Devanagari/);
  assert.match(prompt, /answer again clearly/);
});

test("a check trailer round-trips without touching the answer body", () => {
  const body = "Answer text with a \n line break and `code`.";
  const result = checkReply(body, { prompt: "hello there friend" });
  const wire = body + encodeCheck(result);
  const decoded = decodeCheck(wire);
  assert.equal(decoded.text, body);
  assert.equal(decoded.check?.ok, true);
});

test("a reply without a trailer decodes to itself", () => {
  const decoded = decodeCheck("just an answer");
  assert.equal(decoded.text, "just an answer");
  assert.equal(decoded.check, null);
});
