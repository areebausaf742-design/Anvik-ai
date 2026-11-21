/**
 * Cost ceilings — and nothing that answers a question.
 *
 * This file used to hold the "unlimited / low credit" layer: canned replies for
 * greetings, a seven-day answer cache, a corpus lookup and history folding. All
 * of it answered questions without asking the model, and one of those paths told
 * a user that a car was a reviewed scheme answer. It is gone.
 *
 * What remains is the only part that was ever safe: the limits every request is
 * held to, so a free key cannot be burned by a runaway prompt or a Pro model.
 *
 *   · gemini-2.0-flash only — no Pro tier, no reasoning models
 *   · 800 output tokens in chat, 1,500 in the Code Lab
 *   · temperature capped at 0.7
 *   · 100 live answers per device per day, and every one of them is a live answer
 */

/** Flash only. A paid or Pro model must never be reachable from config. */
export const ALLOWED_MODELS = ["gemini-2.0-flash"];
export const CHAT_MAX_TOKENS = 800;
export const CODE_MAX_TOKENS = 1500;
export const MAX_TEMPERATURE = 0.7;

/**
 * Soft daily ceiling. This one still counts, because it is about cost rather
 * than caching: without it a single device could spend a shared key's free tier
 * in an afternoon. Nothing is answered locally when the limit is reached — the
 * user is told to come back tomorrow.
 */
export const SOFT_DAILY_LIMIT = 100;

/** True when the configured model is one we are willing to call. */
export function isAllowedModel(model: string): boolean {
  return ALLOWED_MODELS.includes(model.trim().toLowerCase());
}

export const LIMIT_REACHED =
  `You've reached ${SOFT_DAILY_LIMIT} answers today on this device. Every answer costs a model call now, so the limit resets at midnight IST.`;
