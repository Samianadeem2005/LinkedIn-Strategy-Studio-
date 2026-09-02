import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Returns an array of Gemini API keys configured in GEMINI_API_KEY environment variable.
 * Supports comma-separated keys (e.g. "KEY1, KEY2, KEY3").
 */
export function getGeminiApiKeys(): string[] {
  const envVal = process.env.GEMINI_API_KEY || '';
  const keys = envVal
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  return keys;
}

/**
 * Executes a callback function with available Gemini API keys in rotation/fallback order.
 * If Key 1 fails due to rate-limit / quota (429 or RESOURCE_EXHAUSTED), it automatically tries Key 2, Key 3, etc.
 */
export async function callWithGeminiFallback<T>(
  fn: (genAI: GoogleGenerativeAI, apiKey: string) => Promise<T>
): Promise<T> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const MAX_PASSES = 2;
  let lastError: unknown = null;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (pass > 0) {
      // Pause briefly before second pass to let temporary 503/429 spikes clear
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const genAI = new GoogleGenerativeAI(key);
        return await fn(genAI, key);
      } catch (err: any) {
        const errStr = String(err?.message || err);
        console.warn(`Gemini API key #${i + 1} (${key.slice(0, 8)}...) failed (Pass ${pass + 1}):`, errStr);
        lastError = err;

        // On ANY error (503, 429, 500, network timeout, etc.), immediately rotate to next API key if available
        if (i < keys.length - 1) {
          console.info(`Rotating to fallback Gemini API key #${i + 2}...`);
          continue;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini API keys failed after multiple retries.');
}
