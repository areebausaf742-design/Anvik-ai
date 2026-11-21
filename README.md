# ANVIK AI

**One Mind. Infinite Possibilities.** A personal AI universe for conversation, image-making, code, and voice.

## What works

- Streaming AI conversations with Fast, Smart, Creative, and Coder modes through Vercel AI Gateway.
- Local chat history, conversation search, prompt suggestions, voice dictation, and response copy.
- Image Studio with live image generation through the Gateway image model.
- Code Lab that streams code drafts and explanations.
- Voice Mode using browser speech recognition (supported browsers will request microphone permission).
- Adjustable response character and history controls.

Conversation history and preferences are stored in local browser storage. This is a single-device experience; there is no account synchronization or authentication service configured. File selection in Chat currently records selected filenames in the prompt; file contents are not uploaded or analyzed.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Vercel deployments authenticate AI Gateway requests automatically. For local model access, set `AI_GATEWAY_API_KEY` in `.env.local` using a key from Vercel AI Gateway. Do not put provider credentials in browser code. `OPENAI_API_KEY` is included as a compatibility reference but the app does not read it; all model access is routed through AI Gateway.

## Deploy to Vercel

Import this repository in Vercel and deploy with the detected Next.js settings. The AI Gateway integration is connected to the project and supplies deployed model access. For local tests, add `AI_GATEWAY_API_KEY` to your untracked `.env.local` file.

## Project checks

```bash
npm test
npm run typecheck
npm run build
```

The `/api/ask` and existing public-answer routes are retained from the original Anvik experience. The new application uses `/api/chat` and `/api/image`.
