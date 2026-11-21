# ANVIK AI

**One Mind. Infinite Possibilities.** A personal AI universe for conversation, image-making, code, and voice.

## What works

- Streaming AI conversations with Fast, Smart, Creative, and Coder modes through Google Gemini 2.0 Flash.
- Local chat history, conversation search, prompt suggestions, voice dictation, and response copy.
- Image Studio UI is retained; Gemini 2.0 Flash does not provide image-file generation, so image generation requires a separate image-generation model.
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

ANVIK uses Google Gemini 2.0 Flash through `@ai-sdk/google`. Get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey). To use it locally, set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`. You can also save a browser-specific key in Settings; that key is stored in this browser's localStorage and sent only with your own AI requests. Never commit API keys.

## Deploy to Vercel

Import this repository in Vercel and deploy with the detected Next.js settings. For live AI in production, open Vercel > Settings > Environment Variables, add `GOOGLE_GENERATIVE_AI_API_KEY` with your Google AI Studio key, and redeploy. Without a key, Chat remains available in Demo Mode with three smart canned replies.

## Project checks

```bash
npm test
npm run typecheck
npm run build
```

The `/api/ask` and existing public-answer routes are retained from the original Anvik experience. Live AI routes `/api/chat`, `/api/code`, `/api/voice`, and `/api/vision` use Google Gemini 2.0 Flash. Gemini 2.0 Flash does not generate image files, so `/api/image` returns a clear unsupported-model response rather than calling a different provider.
