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

  let lastError: unknown = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const genAI = new GoogleGenerativeAI(key);
      return await fn(genAI, key);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      console.warn(`Gemini API key #${i + 1} (${key.slice(0, 8)}...) failed:`, errStr);
      lastError = err;

      // If it's a quota, rate limit, resource exhausted, or network error, continue to next key
      const isQuotaOrLimit =
        errStr.includes('429') ||
        errStr.includes('RESOURCE_EXHAUSTED') ||
        errStr.includes('Quota') ||
        errStr.includes('fetch failed') ||
        errStr.includes('limit');

      if (isQuotaOrLimit && i < keys.length - 1) {
        console.info(`Rotating to fallback Gemini API key #${i + 2}...`);
        continue;
      }
    }
  }

  throw lastError || new Error('All Gemini API keys failed.');
}
