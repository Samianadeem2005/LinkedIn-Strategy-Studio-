import fs from 'fs';
import path from 'path';
import { getDb, getEligibleAnatomiesForIntent, selectAnatomyLRU, updateAnatomyLastUsed } from '../lib/db';
import { resolveContentIntent } from '../lib/intentResolver';
import { callWithGeminiFallback } from '../lib/gemini';
import { validatePostGeneration } from '../lib/validation';

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function testLiveGeneration() {
  console.log('--- Testing Live Gemini Post Generation ---');
  if (!process.env.GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY configured in environment, skipping live API call.');
    return;
  }

  const db = getDb();
  const authorityPillar = db.prepare("SELECT * FROM post_types WHERE name = 'Authority'").get() as any;
  if (!authorityPillar) throw new Error('Authority pillar not found');

  const rawNotes = 'I noticed Pakistani B2B startups are increasingly moving away from standalone apps and instead building features directly inside WhatsApp APIs. Customer acquisition costs on mobile apps were brutal, but WhatsApp has 100% daily retention in the wholesale bazaars.';

  const resolved = resolveContentIntent(rawNotes, authorityPillar.id, authorityPillar.name);
  console.log(`Resolved Intent: ${resolved.intentName} (${resolved.displayName})`);

  const eligibleAnatomies = getEligibleAnatomiesForIntent(authorityPillar.id, resolved.intentId);
  const selectedAnatomy = selectAnatomyLRU(eligibleAnatomies);
  if (!selectedAnatomy) throw new Error('No anatomy selected');
  console.log(`Selected Anatomy: ${selectedAnatomy.name}`);

  let steps: string[] = [];
  try { steps = JSON.parse(selectedAnatomy.thinking_flow || '[]'); } catch { steps = [selectedAnatomy.thinking_flow || '']; }

  const prompt = `
ROLE / AUTHOR CONTEXT:
You are an AI Engineer & Tech Lead writing authentic LinkedIn content.

ACTIVE PILLAR: Authority
CONTENT INTENT: ${resolved.displayName}
POST FORMAT: Text Post (600–1,200 characters, ~100–200 words)

PILLAR CORE FOCUS:
Position the writer as knowledgeable through credible observation, industry trends, and original synthesis. Paragraph-led analysis, not generic listicles.

ACTIVE ANATOMY (THINKING JOURNEY):
Name: ${selectedAnatomy.name}
Purpose: ${selectedAnatomy.purpose}

THINKING FLOW:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

WRITING STYLE & GUIDELINES:
- Paragraph-led. Use natural flowing paragraphs.
- DO NOT output the thinking flow steps as visible labels (e.g. NEVER write "Observation:", "Evidence:", "Why:", "Interpretation:", "Implication:").
- Do NOT force numbered lists unless genuinely called for.
- Let the ideas progress naturally through the thinking journey.
- Casual, authentic, sharp tone. No corporate buzzwords. No rhetorical questions. No em dashes.

RAW NOTES:
${rawNotes}

TASK:
Produce 3 distinct versions of the post following the selected anatomy thinking flow, each starting with a different angle/entry point.
Stay within 600–1,200 characters per version.

Respond strictly in valid JSON format:
{
  "versions": [
    {
      "version": 1,
      "hookType": "Direct Observation",
      "angle": "Operational reality",
      "content": "Full text of Version 1...",
      "visualSuggestion": "Optional visual idea"
    },
    {
      "version": 2,
      "hookType": "Contrarian / Shift",
      "angle": "Economic necessity",
      "content": "Full text of Version 2...",
      "visualSuggestion": "Optional visual idea"
    },
    {
      "version": 3,
      "hookType": "Founders Lens",
      "angle": "Distribution friction",
      "content": "Full text of Version 3...",
      "visualSuggestion": "Optional visual idea"
    }
  ]
}
`.trim();

  console.log('Sending request to Gemini 3.6 Flash...');
  const response = await callWithGeminiFallback(async (genAI) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
  console.log('Response received! Parsing JSON...');

  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch {
    const cleaned = response.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const validation = validatePostGeneration(parsed, { name: 'text_post', min: 600, max: 1200 });
  console.log(`Validation result: isValid=${validation.isValid}, warnings=${validation.warnings.length}`);

  console.log('\n--- Generated Version 1 ---');
  console.log(parsed.versions[0].content);
  console.log(`Length: ${parsed.versions[0].content.length} chars`);

  console.log('\n--- Generated Version 2 ---');
  console.log(parsed.versions[1].content);
  console.log(`Length: ${parsed.versions[1].content.length} chars`);

  console.log('\n--- Verification ---');
  const hasLabels = /^(Observation|Evidence|Why|Interpretation|Implication|Step \d):/m.test(parsed.versions[0].content);
  console.log(`Contains visible section labels: ${hasLabels ? 'YES ❌' : 'NO ✅ (Clean natural flow)'}`);
}

testLiveGeneration().catch(console.error);
