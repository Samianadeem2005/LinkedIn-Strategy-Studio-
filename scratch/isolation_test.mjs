import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const geminiKey = (envVars['GEMINI_API_KEY'] || '').split(',')[0].trim();
const tavilyKey = envVars['TAVILY_API_KEY'] || '';

console.log('Gemini Key length:', geminiKey.length);
console.log('Tavily Key length:', tavilyKey.length);

async function runIsolationTest() {
  const query = 'Why is LangChain used? What are its components and flow?';

  // 1. Tavily Search
  const searchRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${query} official documentation technical architecture guide best practices`,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 6
    })
  });
  const searchData = await searchRes.json();
  const resultsText = [
    searchData.answer ? `SUMMARY:\n${searchData.answer}` : '',
    ...((searchData.results || []).map((r, i) => `SOURCE ${i + 1}: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.content?.slice(0, 600)}`))
  ].filter(Boolean).join('\n\n---\n\n');

  console.log('\n--- TAVILY SEARCH RESULTS HAS LANGCHAIN? ---', resultsText.toLowerCase().includes('langchain'));

  // 2. Bare-minimum Isolation Prompt (NO pillar rules, NO tone, NO banned phrases, NO writing mechanics)
  const barePrompt = `Write 3 distinct versions of a LinkedIn post about this topic using the search results provided.

TOPIC: ${query}

SEARCH RESULTS:
${resultsText}

Respond with ONLY valid JSON:
{
  "versions": [
    {
      "version": 1,
      "sections": {
        "Hook": "...",
        "Rehook": "...",
        "Context": "...",
        "Breakdown": "...",
        "CTA": "..."
      }
    },
    { "version": 2, "sections": { ... } },
    { "version": 3, "sections": { ... } }
  ]
}`;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const modelName = envVars['GEMINI_MODEL'] || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(barePrompt);
  const outputText = result.response.text();

  console.log('\n=== BARE MINIMAL ISOLATION TEST OUTPUT ===');
  console.log(outputText);
  console.log('\n--- BARE ISOLATION OUTPUT CONTAINS LANGCHAIN? ---', outputText.toLowerCase().includes('langchain'));
}

runIsolationTest().catch(console.error);
