# Anvik-ai

Ask anything — one field, no account, answers in the language you write.

The product plan lives in [`docs/ANVIK-PLAN.md`](docs/ANVIK-PLAN.md). Read it first;
it is the source of truth for positioning, design tokens, the cost model and the
ten-week schedule, and it records its own corrections and owner amendments (§0, §3.6).

## Run

```bash
npm install
npm run build
npm run start        # http://localhost:3000
```

## Live model

Set **`GEMINI_API_KEY`** (or `GOOGLE_API_KEY`) in server-side env only. With it set,
`/api/ask` streams from the Gemini API (`streamGenerateContent?alt=sse`, 600-token
output cap, identical cacheable system prompt). Without it, a deterministic corpus
engine answers so the product stays demonstrable. The key never reaches the client:
`lib/provider.ts` is imported only by the server route.

Optional: `ANVIK_MODEL` (default `gemini-2.5-flash`).

## Guard rails enforced in /api/ask, in this order

safety route → jailbreak refusal → rate limit → daily quota → **₹500/day global
spend ceiling** → generation. New answers are public by URL but `noindex` until a
human reviews them; the home gallery shows reviewed answers only.

## Checks

```bash
npm test          # node:test via tsx — detection, slugs, quota race, ceiling, gallery gate
npm run typecheck # tsc --noEmit
npm run lint      # next lint
npm run build
```

State lives in `data/db.json` (gitignored) — delete it to reseed.
