# Anvik-ai

हिंदी/Hinglish-first "ask anything" — one field, one button, every answer shareable.

The product plan lives in [`docs/ANVIK-PLAN.md`](docs/ANVIK-PLAN.md). Read it first;
it is the source of truth for positioning, design tokens, the cost model and the
ten-week schedule, and it records its own corrections (§0).

## Run

```bash
npm install
npm run build
npm run start        # http://localhost:3000
```

The app runs in **demo mode**: a deterministic Hindi/Hinglish/English answer engine
over a seeded launch-category corpus (schemes, forms, official process), behind the
exact interfaces Week 1's live provider will plug into (`lib/provider.ts`).
No API keys exist anywhere in the client; `/api/ask` is the only route that would
ever hold one.

State lives in `data/db.json` (gitignored) — delete it to reseed.
