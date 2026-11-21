/**
 * Storage layer — plan §6.3 (seven tables), implemented here as a single
 * JSON document behind the same interface Postgres will get in Week 6.
 * Every read/write goes through this module; nothing else touches disk.
 *
 * This is deliberately NOT the production store. It exists so the Week 2–3
 * loop is real end-to-end. Swapping to Supabase Postgres means reimplementing
 * this interface with the service role, plus the anon-cannot-write test (§5.2).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CORPUS, type CorpusEntry } from "./corpus";
import { slugify } from "./transliterate";
import type { Lang } from "./detect";

export type ModerationState = "clean" | "flagged" | "removed";

export type QuestionRow = {
  id: string;
  deviceId: string;
  text: string;
  lang: Lang;
  slug: string | null;
  idempotencyKey: string | null;
  createdAt: number;
  status: "answered" | "duplicate" | "refused" | "partial";
};

export type AnswerRow = {
  id: string;
  questionId: string;
  body: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costPaise: number;
  latencyMs: number;
  isPublic: boolean;
  publishedAt: number;
  moderationState: ModerationState;
  /** Owner spec 21 Nov: /j/ pages stay noindex and out of the gallery until
   *  a human reviews them. Seed corpus is authored = reviewed. */
  reviewed: boolean;
  lang: Lang;
  slug: string;
};

export type ModerationRow = {
  id: string;
  questionText: string;
  stage: "input" | "output" | "report";
  reasonCode: string;
  action: string;
  createdAt: number;
};

type DB = {
  questions: QuestionRow[];
  answers: AnswerRow[];
  quota: Record<string, { day: string; remaining: number }>;
  moderation: ModerationRow[];
  idempotency: Record<string, string>; // key -> answerId
};

export const FREE_DAILY = 3;
export const RATE_PER_MIN = 6;
export const RATE_PER_HOUR = 20;
/** Plan §7.4 control 1: global daily model-spend ceiling, in paise (₹500). */
export const DAILY_CEILING_PAISE = 50000;

const DATA_DIR = path.join(process.cwd(), process.env.ANVIK_DATA_DIR ?? "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const g = globalThis as unknown as { __anvikDb?: DB; __anvikLock?: Promise<unknown> };

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function seed(): DB {
  const db: DB = { questions: [], answers: [], quota: {}, moderation: [], idempotency: {} };
  const now = Date.now();
  CORPUS.forEach((entry: CorpusEntry, i: number) => {
    const slug = slugify(entry.questions.en);
    const qId = `q-seed-${entry.id}`;
    const aId = `a-seed-${entry.id}`;
    db.questions.push({
      id: qId,
      deviceId: "seed",
      text: entry.questions.en,
      lang: "en",
      slug,
      idempotencyKey: null,
      createdAt: now - (CORPUS.length - i) * 3600_000,
      status: "answered",
    });
    db.answers.push({
      id: aId,
      questionId: qId,
      body: entry.answers.en,
      model: "seed-corpus",
      promptTokens: 2270,
      outputTokens: estimateTokens(entry.answers.en),
      cachedTokens: 2200,
      costPaise: 12,
      latencyMs: 4200,
      isPublic: true,
      publishedAt: now - (CORPUS.length - i) * 3600_000,
      moderationState: "clean",
      reviewed: true,
      lang: "en",
      slug,
    });
  });
  return db;
}

function migrate(db: DB): DB {
  db.answers = db.answers.map((a) => ({
    ...a,
    reviewed: a.reviewed ?? a.model === "seed-corpus",
  }));
  return db;
}

function load(): DB {
  if (g.__anvikDb) return g.__anvikDb;
  if (!existsSync(DB_FILE)) {
    mkdirSync(DATA_DIR, { recursive: true });
    const db = migrate(seed());
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    g.__anvikDb = db;
    return db;
  }
  const db = migrate(JSON.parse(readFileSync(DB_FILE, "utf8")) as DB);
  g.__anvikDb = db;
  return db;
}

/** Single-writer mutex: good enough for one demo process; Postgres owns this in Week 6. */
function withLock<T>(fn: () => T): Promise<T> {
  const prev = g.__anvikLock ?? Promise.resolve();
  const run = prev.then(() => fn());
  g.__anvikLock = run.catch(() => undefined);
  return run;
}

function persist(db: DB) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/** §7.1 planning factor: ~1.9 tokens per Devanagari word ≈ 0.61 tokens/char. */
export function estimateTokens(text: string): number {
  const deva = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const perChar = deva / Math.max(1, text.length) > 0.3 ? 0.61 : 0.28;
  return Math.ceil(text.length * perChar);
}

/** §7.2 cost formula at Flash-class prices, ₹95/$ (planning rate). */
export function estimateCostPaise(outputTokens: number, cachedTokens = 2200, uncachedIn = 70): number {
  const usd = (cachedTokens * 0.03 + uncachedIn * 0.3 + outputTokens * 2.5) / 1_000_000;
  return Math.max(1, Math.round(usd * 95 * 100));
}

/* ------------------------------------------------------------------ */

export const store = {
  publicAnswers(): AnswerRow[] {
    return load()
      .answers.filter((a) => a.isPublic && a.moderationState !== "removed")
      .sort((a, b) => b.publishedAt - a.publishedAt);
  },

  /** Reviewed public answers joined to their question text, newest first.
   *  The gallery shows only these (owner spec, 21 Nov). */
  reviewedWithQuestions(): { answer: AnswerRow; question: string }[] {
    const db = load();
    return store
      .publicAnswers()
      .filter((a) => a.reviewed)
      .map((answer) => ({
        answer,
        question: db.questions.find((q) => q.id === answer.questionId)?.text ?? "",
      }));
  },

  /** Plan §7.4 control 1: model spend so far today, in paise. */
  todayCostPaise(): number {
    const day = dayKey();
    return load()
      .answers.filter((a) => new Date(a.publishedAt).toISOString().slice(0, 10) === day)
      .reduce((sum, a) => sum + a.costPaise, 0);
  },

  /** Public answers joined to their question text, newest first. */
  publicWithQuestions(): { answer: AnswerRow; question: string }[] {
    const db = load();
    return store.publicAnswers().map((answer) => ({
      answer,
      question: db.questions.find((q) => q.id === answer.questionId)?.text ?? "",
    }));
  },

  bySlug(slug: string): AnswerRow | undefined {
    return load().answers.find((a) => a.slug === slug && a.moderationState !== "removed");
  },

  questionRemaining(deviceId: string): number {
    const db = load();
    const entry = db.quota[deviceId];
    if (!entry || entry.day !== dayKey()) return FREE_DAILY;
    return entry.remaining;
  },

  /** Atomic single-statement decrement, in spirit (§6.2): one check-and-set, no TOCTOU. */
  async decrementQuota(deviceId: string): Promise<number | null> {
    return withLock(() => {
      const db = load();
      const today = dayKey();
      let entry = db.quota[deviceId];
      if (!entry || entry.day !== today) entry = db.quota[deviceId] = { day: today, remaining: FREE_DAILY };
      if (entry.remaining <= 0) return null;
      entry.remaining -= 1;
      persist(db);
      return entry.remaining;
    });
  },

  async recordQuestion(row: Omit<QuestionRow, "id" | "createdAt">): Promise<QuestionRow> {
    return withLock(() => {
      const db = load();
      const full: QuestionRow = { ...row, id: `q-${crypto.randomUUID()}`, createdAt: Date.now() };
      db.questions.push(full);
      persist(db);
      return full;
    });
  },

  async recordAnswer(row: Omit<AnswerRow, "id" | "publishedAt">): Promise<AnswerRow> {
    return withLock(() => {
      const db = load();
      const full: AnswerRow = { ...row, id: `a-${crypto.randomUUID()}`, publishedAt: Date.now() };
      db.answers.push(full);
      persist(db);
      return full;
    });
  },

  async bindIdempotency(key: string, answerId: string): Promise<void> {
    return withLock(() => {
      const db = load();
      db.idempotency[key] = answerId;
      persist(db);
    });
  },

  idempotentAnswer(key: string): AnswerRow | undefined {
    const db = load();
    const id = db.idempotency[key];
    if (!id) return undefined;
    return db.answers.find((a) => a.id === id);
  },

  async logModeration(row: Omit<ModerationRow, "id" | "createdAt">): Promise<void> {
    return withLock(() => {
      const db = load();
      db.moderation.push({ ...row, id: `m-${crypto.randomUUID()}`, createdAt: Date.now() });
      persist(db);
    });
  },

  /** §4.3 duplicate check: normalised token-overlap, no embeddings. */
  findPublicMatch(question: string, threshold = 0.75): AnswerRow | undefined {
    const q = normTokens(question);
    if (q.size === 0) return undefined;
    for (const a of store.publicAnswers()) {
      const qRow = load().questions.find((x) => x.id === a.questionId);
      if (!qRow) continue;
      const t = normTokens(qRow.text);
      if (t.size === 0) continue;
      let inter = 0;
      for (const tok of q) if (t.has(tok)) inter++;
      const overlap = inter / Math.min(q.size, t.size);
      if (overlap >= threshold) return a;
    }
    return undefined;
  },
};

const STOP = new Set([
  "kya","kaise","hai","hain","the","a","an","is","are","how","do","i","my","me","to",
  "for","what","should","ka","ki","karein","karun","kya","mein","se","ko","ka","ho",
]);

export function normTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Corpus retrieval for demo mode: same overlap maths, looser threshold. */
export function corpusMatch(question: string, threshold = 0.34) {
  const corpus = CORPUS;
  const q = normTokens(question);
  let best: { entry: (typeof corpus)[number]; score: number } | null = null;
  for (const entry of corpus) {
    const pooled = new Set<string>();
    for (const variant of Object.values(entry.questions)) {
      for (const tok of normTokens(variant)) pooled.add(tok);
    }
    if (pooled.size === 0) continue;
    let inter = 0;
    for (const tok of q) if (pooled.has(tok)) inter++;
    const score = q.size ? inter / q.size : 0;
    if (score >= threshold && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}
