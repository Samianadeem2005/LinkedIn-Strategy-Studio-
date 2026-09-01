import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const geminiKeys = (envVars['GEMINI_API_KEY'] || '').split(',').map(k => k.trim()).filter(Boolean);
const tavilyKey = envVars['TAVILY_API_KEY'] || '';

async function callModel(prompt) {
  const modelsToTry = ['gemini-3.6-flash'];
  for (const modelName of modelsToTry) {
    for (const key of geminiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        console.log(`[Success with ${modelName}]`);
        return res.response.text();
      } catch (e) {
        console.warn(`[${modelName}] failed with key ${key.slice(0, 10)}:`, e.message);
      }
    }
  }
  throw new Error('All keys failed');
}

async function run() {
  const query = 'Why is LangChain used? What are its components and flow?';

  // Fetch Tavily
  const tavRes = await fetch('https://api.tavily.com/search', {
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
  const searchData = await tavRes.json();
  const resultsText = [
    searchData.answer ? `SUMMARY:\n${searchData.answer}` : '',
    ...((searchData.results || []).map((r, i) => `SOURCE ${i + 1}: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.content?.slice(0, 600)}`))
  ].filter(Boolean).join('\n\n---\n\n');

  console.log('--- TAVILY CONTAINS LANGCHAIN? ---', resultsText.toLowerCase().includes('langchain'));

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
    }
  ]
}`;

  console.log('\n--- CALLING BARE MINIMAL ISOLATION TEST ---');
  const text = await callModel(barePrompt);
  console.log('\n=== ISOLATION TEST OUTPUT ===');
  console.log(text);
  console.log('\n--- ISOLATION OUTPUT CONTAINS "LangChain"? ---', text.includes('LangChain') || text.includes('langchain'));
}

run().catch(console.error);
