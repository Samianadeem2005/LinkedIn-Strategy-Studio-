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

async function runTestForPillar(pillarName, rawNotes) {
  console.log(`\n==================================================`);
  console.log(`RUNNING FULL GENERATION TEST FOR PILLAR: ${pillarName}`);
  console.log(`TOPIC / NOTES: "${rawNotes}"`);

  // 1. Tavily Search
  const tavRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${rawNotes} technical comparison architecture guide best practices`,
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

  // 2. Load DB configs
  const postType = db.prepare('SELECT * FROM post_types WHERE name = ?').get(pillarName);
  const dos = JSON.parse(postType.dos);
  const donts = JSON.parse(postType.donts);
  const coreFocus = postType.core_focus;

  const writingMechanics = db.prepare('SELECT prompt_directive, description FROM writing_mechanics WHERE enabled = 1 ORDER BY order_index ASC').all();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const anatomySections = db.prepare('SELECT * FROM post_anatomy ORDER BY order_index ASC').all();

  const allHookTypes = db.prepare('SELECT * FROM hook_types').all();
  const selectedHookTypes = allHookTypes.slice(0, 5);
  const hookBankList = selectedHookTypes.map(ht => {
    let parsedAngles = [];
    try { parsedAngles = JSON.parse(ht.angles); } catch {}
    return `${ht.name} — ${ht.description} (angles: ${parsedAngles.join(' / ')})`;
  }).join('\n');

  const anatomyPrompt = anatomySections.map((s, i) => `${i + 1}. **${s.section_name}**: ${s.rule_description}`).join('\n');
  const userAboutMe = settings?.about_me || "I am an AI Engineer building in public on LinkedIn.";
  const tone = JSON.parse(settings?.tone_profile || '{}');
  const activeFormat = { name: 'Standard', min: 1000, max: 2000 };

  const modeInstructions = `## MODE B — Research & Generate via Web Search & Official Docs
TOPIC: ${rawNotes}
SEARCH RESULTS:
${webResults}
- **Extract Technical Specs**: Pull official framework docs, API specs, architecture patterns.
- **Synthesize**: Re-explain the full concept end-to-end in your own engineering voice.`;

  const prompt = `You are an expert LinkedIn content strategist writing on behalf of:
${userAboutMe}

ACTIVE MODE: Mode B — Research & Generate via Web Search & Official Docs

TODAY'S PILLAR: ${postType.name}

TARGET POST FORMAT: ${activeFormat.name} (Mandatory Length: STRICTLY between ${activeFormat.min} and ${activeFormat.max} characters across all sections combined)

ACTIVE PILLAR'S CORE FOCUS:
${coreFocus}

ACTIVE PILLAR'S DOs:
${dos.map(d => `✓ ${d}`).join('\n')}

ACTIVE PILLAR'S DON'Ts:
${donts.map(d => `✗ ${d}`).join('\n')}

ACTIVE POST ANATOMY:
${anatomyPrompt}

WRITING MECHANICS DIRECTIVES:
${writingMechanics.map(m => `• ${m.prompt_directive || m.description}`).join('\n')}

AVAILABLE HOOK TYPES:
${hookBankList}

Pick ONE hook type that best fits today's pillar and topic. Write an original sentence per version following one of its angles.

TONE & VOICE PROFILE:
- Formality: ${tone.formality || 'Conversational'}
- Sentence length: ${tone.sentenceLength || 'short'}
- Language mix: ${tone.languageMix || 'Clear, professional English'}
- NEVER use these phrases: ${tone.bannedPhrases ? tone.bannedPhrases.join(', ') : 'none'}

---

${modeInstructions}

---

## Output Format
Return exactly 3 versions. For each version, output every section in Post Anatomy plus visualSuggestion and resources array.
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
      },
      "visualSuggestion": "...",
      "resources": [...]
    },
    { "version": 2, "sections": { ... }, "visualSuggestion": "...", "resources": [...] },
    { "version": 3, "sections": { ... }, "visualSuggestion": "...", "resources": [...] }
  ]
}`;

  const genAI = new GoogleGenerativeAI(geminiKeys[0]);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log(`\n=== OUTPUT FOR ${pillarName} ===`);
  console.log(text);

  const lcMatches = (text.match(/langchain/gi) || []).length;
  const liMatches = (text.match(/llamaindex/gi) || []).length;
  console.log(`\n--- MENTION STATS FOR ${pillarName} ---`);
  console.log(`"LangChain" matches: ${lcMatches}`);
  console.log(`"LlamaIndex" matches: ${liMatches}`);
}

async function main() {
  await runTestForPillar('Lead Magnet', 'LangChain vs LlamaIndex comparison cheat sheet and decision framework');
  await runTestForPillar('Personal', 'Spending 4 hours debugging a complex LangChain memory leak in production');
}

main().catch(console.error);
