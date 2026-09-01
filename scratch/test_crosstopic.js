import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
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
const db = new Database('linkedin_content.db');

async function runCrossTopicTest(topicName) {
  const query = `Why is ${topicName} used? Key architecture and components`;
  
  // Fetch Tavily
  const tavRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${query} official documentation technical architecture guide`,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 5
    })
  });
  const searchData = await tavRes.json();
  const webResults = [
    searchData.answer ? `SUMMARY:\n${searchData.answer}` : '',
    ...((searchData.results || []).map((r, i) => `SOURCE ${i + 1}: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.content?.slice(0, 500)}`))
  ].filter(Boolean).join('\n\n---\n\n');

  // Load Value pillar
  const postType = db.prepare("SELECT * FROM post_types WHERE name = 'Value'").get();
  const dos = JSON.parse(postType.dos);
  const donts = JSON.parse(postType.donts);
  const coreFocus = postType.core_focus;

  const userAboutMe = "I am an AI Engineer building in public on LinkedIn.";

  const prompt = `You are an expert LinkedIn content strategist writing on behalf of:
${userAboutMe}

ACTIVE MODE: Mode B — Research & Generate via Web Search & Official Docs

TODAY'S PILLAR: ${postType.name}

ACTIVE PILLAR'S CORE FOCUS:
${coreFocus}

ACTIVE PILLAR'S DOs:
${dos.map(d => `✓ ${d}`).join('\n')}

ACTIVE PILLAR'S DON'Ts:
${donts.map(d => `✗ ${d}`).join('\n')}

TOWARDS TOPIC: ${query}

SEARCH RESULTS:
${webResults}

## MODE B — Research & Generate via Web Search & Official Docs
- **Extract Technical Specs**: Pull official framework docs, API specs.
- **Synthesize**: Re-explain the full concept end-to-end in your own engineering voice with practical workflow steps & trade-offs.

Return JSON with 1 version having Hook, Rehook, Context, Breakdown, CTA sections.`;

  const genAI = new GoogleGenerativeAI(geminiKeys[0]);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  console.log(`\n================ CROSS TOPIC TEST: ${topicName} ================`);
  console.log(text);
  console.log(`Contains "${topicName}"?`, text.toLowerCase().includes(topicName.toLowerCase()));
}

async function main() {
  await runCrossTopicTest('FastAPI');
  await runCrossTopicTest('Mem0');
}

main().catch(console.error);
