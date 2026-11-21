# ANVIK AI

**A straight answer, in the language you asked in.** Ask in English, Hindi or Hinglish and get the
steps, the fee, the office and the official page — free to start, no account required.

## What works

- **Chat** (`/chat`) — streaming conversations with Fast / Smart / Creative / Coder modes, Markdown
  rendering, conversation search, browser dictation, copy-to-clipboard. History is kept in this
  browser (capped so it can't silently stop saving).
- **Image studio** (`/image`) — Gemini image generation when a key is present, automatically falling
  back to the free Pollinations Flux endpoint. The gallery stores **URLs**, capped at 6, never base64.
- **Code lab** (`/code`) — streams a code draft plus an explanation from `/api/code`.
- **Voice** (`/voice`) — browser speech recognition, then the transcript is answered by `/api/voice`.
- **Vision** (`/vision`) — upload an image (≤3 MB) and ask about it.
- **Answer engine** (`/api/ask`, `/j/[slug]`) — the corpus-backed, three-language answer path with
  quota, rate limiting, moderation and a spend ceiling. Public answers get their own shareable page.
- **Settings** (`/settings`) — add or remove a browser-local Gemini key, pick a mode, set response
  character, clear history.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

Open http://localhost:3000. Without a key the product still runs: Chat answers in demo mode,
`/api/ask` answers from the corpus, and Code/Voice/Vision return a clear "add a key" message.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | recommended | The **only** Gemini key name. Used by every route. |
| `NEXT_PUBLIC_SITE_URL` | in production | Canonical origin for sitemap, robots, metadata and share cards. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | optional | Mirror questions/answers to Postgres (schema in `lib/supabase.ts`). |
| `ANVIK_MODEL` / `ANVIK_IMAGE_MODEL` | optional | Model overrides. |

A user can also paste their own key in Settings; it stays in that browser and is sent only with
their own requests.

## Storage and why it never 500s

`lib/store.ts` resolves, in order: Supabase (when configured) → in-memory document seeded from the
corpus → a JSON file **only if the filesystem is writable**. On a read-only deployment filesystem
the file step is skipped silently, so `/j/[slug]`, `/sitemap.xml` and `/api/ask` keep answering from
memory instead of throwing `EACCES`.

## Project checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # 14 tests, node:test
npm run build       # production build
```

## Deploy

Import the repo in Vercel, add `GOOGLE_GENERATIVE_AI_API_KEY` and `NEXT_PUBLIC_SITE_URL`, then
deploy. No database is required to boot; add the Supabase variables when you want durable storage.

See `docs/ANVIK-PLAN.md` for the product and design reasoning, and `AUDIT-2026-11-21.md` for the
audit that drove the current structure.
