import { getDb } from '../lib/db';
import { resolveContentIntent } from '../lib/intentResolver';

const db = getDb();
const pts = db.prepare('SELECT id, name FROM post_types').all() as { id: string; name: string }[];
const getPt = (name: string) => pts.find(p => p.name.toLowerCase() === name.toLowerCase())!;

const tests = [
  { notes: 'RAG vs fine-tuning', pillar: 'Value', expected: 'compare' },
  { notes: 'Why my RAG pipeline kept returning irrelevant chunks', pillar: 'Value', expected: 'explain_problem' },
  { notes: 'What exactly is pgvector?', pillar: 'Value', expected: 'teach_concept' },
  { notes: 'I thought RAG meant fine-tuning. I only realized later...', pillar: 'Value', expected: 'correct_misconception' },
  { notes: 'I noticed Pakistani startups are starting to shift towards local payment rails...', pillar: 'Authority', expected: 'industry_observation' },
  { notes: 'How this company changed its pricing strategy and survived', pillar: 'Authority', expected: 'company_analysis' },
  { notes: 'Here is how I built the multi-agent architecture with LangGraph', pillar: 'Showcase', expected: 'architecture_explanation' },
  { notes: 'I kept making the same mistake while building this', pillar: 'Personal', expected: 'failure_reflection' },
  { notes: 'Checklist before you deploy to production', pillar: 'Lead Magnet', expected: 'checklist' }
];

let allPassed = true;
for (const t of tests) {
  const pt = getPt(t.pillar);
  const res = resolveContentIntent(t.notes, pt.id, pt.name);
  const passed = res.intentName === t.expected;
  if (!passed) allPassed = false;
  console.log(`[${t.pillar}] "${t.notes.slice(0, 40)}" => ${res.intentName} (${res.confidence}) [Expected: ${t.expected}] : ${passed ? 'PASS' : 'FAIL'}`);
}

console.log('\nAll passed:', allPassed);
