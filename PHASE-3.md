# Phase 3 — self-check, learning and credit control

Three systems added on top of the merged Phase 1/2 fixes. Every claim below is checked by
`npm test` (54 tests, up from 14), `npm run build`, or `npm run measure`; nothing here is an estimate
stated as a fact.

## What was built

| Requirement | Where | How it works |
| --- | --- | --- |
| Empty answer, retry once, honest message | `lib/checker.ts` (`empty`, blocking) | An answer with no words fails; `/api/chat` returns 401 *Add valid Gemini key in Settings* when the provider yields nothing, exactly as Phase 1 did. |
| Language must match the question | `lib/checker.ts` (`language`) using `lib/detect.ts` | Script ratio + detector. Hindi question answered in English (or the reverse) is flagged. |
| Markdown correctness | `lib/checker.ts` (`markdown`) | Unbalanced `**` removed, an unterminated ``` fence closed. |
| No fake links / dates / stats | `lib/checker.ts` (`link`, `date`, `statistic`) | Unknown URLs **and bare domains** replaced with "the official page"; unknown helplines replaced with a pointer; invented percentages and "trusted by 12,000+" softened; impossible dates reported. |
| No abuse, only real helplines | `lib/checker.ts` (`safety`, `helpline`) | Abuse blocks the answer. `REAL_HELPLINES` mirrors the corpus and a test fails if the two ever drift. |
| Regenerate once with the issue named | `app/api/chat/route.ts` | `repairPrompt()` plus one re-ask; the second answer is kept only if it has fewer issues. |
| Green *Checked* tick | `components/anvik/feedback-bar.tsx` | Shown only when the check passed or was repaired in place. |
| Like / dislike, saved with prompt, reply, timestamp | `lib/learning.ts` + `feedback-bar.tsx` | localStorage `anvik-learning`; optional `/api/learn` mirror when Supabase is configured. |
| "Teach ANVIK" after a dislike | `feedback-bar.tsx` | "What should I have said?" is saved as a correction and replayed for that question. |
| Memory: name, language, style | `settings-screen.tsx` + `lib/learning.ts` | localStorage key **`anvik-memory`**, injected into the system prompt as one line. |
| Learning Dashboard | `settings-screen.tsx` | Corrections, likes, dislikes, replays, top topics, and the 3 most-liked replies. |
| Never learn secrets | `lib/learning.ts` `redact()` | Keys (`AIza…`, `sk-…`, `ghp_…`, JWTs, bearer tokens), `password: …`, Indian mobiles, Aadhaar and card numbers are replaced before storage, and again server-side in `/api/learn`. |
| Local canned answers, zero API calls | `lib/credit.ts` `localAnswer()` | Greetings, thanks, goodbye, "who are you", "what can you do", acknowledgements — in English, Devanagari and Hinglish. |
| 7-day cache, "From memory · 0 credits used" | `lib/credit.ts` + `chat-workspace.tsx` | Route-level memory cache and a browser copy; both expire after 7 days. |
| Cheap model only, capped | `app/api/chat/route.ts` | `gemini-2.0-flash` (never Pro), `maxOutputTokens` 800 chat / 1,500 coder, temperature ≤ 0.7. |
| History summarisation | `lib/credit.ts` `prepareHistory()` | Last 6 turns + one extracted summary line of everything older — no extra model call. |
| Quota UI | `chat-workspace.tsx`, `settings-screen.tsx` | "Today: N chats · M from memory · X% cost nothing", soft limit 100, free sources excluded from the count. |
| Fallback chain | `app/api/chat/route.ts` | Gemini fails → reviewed answer → demo reply; never a blank bubble, never a 500. |
| "Smart Mode ON · Saving credits" | `chat-workspace.tsx` | A real toggle: off means greetings, cache and corpus are skipped and the model is asked. |

## Measured results

`npm run measure` — 41 realistic prompts for one device and one day:

| Source | Count | Cost |
| --- | --- | --- |
| Local answer | 12 | 0 credits |
| Cache replay | 13 | 0 credits |
| Reviewed corpus | 6 | 0 credits |
| Model call | 10 | low credit |
| **Zero-credit share** | **31/41 = 76%** | |
| Same day, every prompt unique (lower bound) | 17/27 = **63%** | |

The brief asked for 40%. Both the realistic day and the no-repeat lower bound clear it.

History summarisation, measured with `estimateTokens()` on a 20-exchange conversation:

| Messages sent | Tokens before | Tokens after | Saved |
| --- | --- | --- | --- |
| 6 | 492 | 492 | 0% |
| 12 | 984 | 624 | 37% |
| 20 | 1,641 | 625 | 62% |
| 40 | 3,291 | 627 | 81% |
| 80 | 6,591 | 627 | 90% |
| 160 | 13,191 | 627 | 95% |

The brief asked for ~70%. A 40-message conversation lands at 81%, and the saving grows with length
because the window is fixed at six turns.

## False-positive audit of the checker

Run against every reviewed answer and every local reply (26 texts): **0 flagged**. Two bugs were
found and fixed while doing this, both of which would have caused pointless regenerations:

- `₹50,000` and "40000 applications" were being read as phone numbers. A digit run now needs a
  helpline word beside it unless it is a 1800 number or a ten-digit mobile.
- `rbi.org.in` was being stripped as an unknown link. Official suffixes (`gov.in`, `nic.in`,
  `ac.in`, `rbi.org.in`, `npci.org.in`, `cibil.com`, …) are allowed, and bare domains — the way the
  corpus itself names sources — are now held to the same rule as hyperlinks.

## Regression check against Phase 1

| Phase 1 guarantee | Status |
| --- | --- |
| Honest 401 for a bad key | **Holds.** Verified on a greeting (401), a live question (401) and a well-formed-but-bogus key (401) — free answers no longer mask a broken key. |
| Demo mode never errors | **Holds.** `X-ANVIK-DEMO: true` on every free answer too, so the "add a key" card cannot disappear. |
| Real CSS for the six pages | **Holds.** All 15 routes 200, `/nope` 404, build 27 routes. |
| Markdown rendering, URL-only gallery | **Untouched** (`markdown.tsx`, `creative-studio.tsx` unchanged). |
| Memory-first store, read-only disk | **Untouched** (`lib/store.ts` unchanged). |
| `lib/corpus.ts` untouched | **Verified:** `git diff --stat lib/corpus.ts` is empty. |
| 14 tests | **Still pass.** Now 54 in total, the original 14 unchanged. |
| 0 vulnerabilities | **Holds** (`npm audit`). |

## Interface changes worth knowing

`/api/chat` no longer streams tokens as they arrive. A reply is buffered server-side, checked, and
only then returned — a checker cannot judge half an answer. Answers are capped at 800 tokens and the
buffer has a 25-second ceiling; if a stream runs past either, the rest is passed through unexamined
and the reply is marked `X-ANVIK-CHECK: partial` (and is never cached). The response is still a
`text/plain` body, so the client read loop is unchanged, and the verdict travels as a private trailer
(`\u2063ANVIK_CHECK:{…}`) that `decodeCheck()` strips before rendering.

New headers: `X-ANVIK-SOURCE`, `X-ANVIK-CREDIT`, `X-ANVIK-FREE`, `X-ANVIK-LABEL`, `X-ANVIK-CHECK`,
`X-ANVIK-REPAIRED`, `X-ANVIK-SAVED`, `X-ANVIK-TOKENS`.

## The Supabase mirror is optional, not a login

The product has no accounts (`/login` says "No account needed"), so "save to Supabase if logged in"
is implemented as: mirror likes, dislikes and corrections to an `anvik_learning` table **only when
the deployment has Supabase configured**. Without the env vars the route answers
`202 {"stored":false,"sync":"not configured"}` and learning stays local. The browser copy is always
the source of truth, so a failed sync never blocks a like.

```sql
create table if not exists anvik_learning (
  id text primary key, device_id text not null, verdict text not null,
  question text not null, answer text not null, correction text not null,
  mode text not null, created_at bigint not null
);
alter table anvik_learning enable row level security;
```

## Known limits

- The checker is deterministic and conservative; it catches invented links, domains, helplines,
  dates, statistics and abusive wording, but it cannot verify a claim against the world. It is a
  safety net, not a fact-checker.
- History summarisation is extraction, not comprehension: earlier *questions* survive, earlier
  answers are reduced to their first sentence.
- A buffer-then-check reply is slower to first token than a streamed one; that is the price of the
  guarantee, and it is bounded by the 800-token cap.
- Live Gemini success paths cannot be exercised in this sandbox (no key, and the endpoint is
  unreachable), so only the failure, free and fallback paths are verified end to end.
