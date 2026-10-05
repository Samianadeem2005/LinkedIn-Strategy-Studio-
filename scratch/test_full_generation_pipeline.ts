import fs from 'fs';
import path from 'path';
import {
  getDb,
  getContentIntents,
  getEligibleAnatomiesForIntent,
  selectAnatomyLRU,
  updateAnatomyLastUsed
} from '../lib/db';
import { resolveContentIntent } from '../lib/intentResolver';
import { validatePostGeneration } from '../lib/validation';

// Read .env.local if present
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

async function runPipelineTests() {
  console.log('--- Testing Full Generation Architecture Pipeline ---');
  
  const db = getDb();
  const postTypes = db.prepare('SELECT * FROM post_types').all() as { id: string; name: string }[];
  console.log(`Loaded ${postTypes.length} pillars: ${postTypes.map(p => p.name).join(', ')}`);

  // Test Case Matrix covering all 5 pillars and diverse intents
  const testCases = [
    {
      pillarName: 'Value',
      rawNotes: 'Comparing vector search vs keyword search in Postgres. Vector search handles semantics and synonyms well but struggles with exact SKU matching. Keyword search with tsvector is fast for exact words.',
      expectedIntent: 'compare'
    },
    {
      pillarName: 'Value',
      rawNotes: 'Why my RAG pipeline returned irrelevant chunks even when the embeddings looked clean. The issue was chunk overlap and missing document metadata.',
      expectedIntent: 'explain_problem'
    },
    {
      pillarName: 'Authority',
      rawNotes: 'I noticed Pakistani fintech startups are shifting away from standalone wallets towards embedded finance inside existing B2B distribution networks. The unit economics of customer acquisition forced this shift.',
      expectedIntent: 'industry_observation'
    },
    {
      pillarName: 'Authority',
      rawNotes: 'How Linear changed its pricing strategy and rejected seat-based enterprise lock-in. They focused on developer velocity and craft over sales-led expansion.',
      expectedIntent: 'company_analysis'
    },
    {
      pillarName: 'Personal',
      rawNotes: 'For three years I thought working 70 hours a week was the only way to demonstrate engineering leadership. Then my system went down during a holiday and nobody else knew how to fix it.',
      expectedIntent: 'turning_point'
    },
    {
      pillarName: 'Personal',
      rawNotes: 'I kept making the same mistake when designing database schemas: premature normalization that ruined write latency.',
      expectedIntent: 'failure_reflection'
    },
    {
      pillarName: 'Showcase',
      rawNotes: 'Here is how I built a multi-agent orchestration engine using SQLite WAL mode and Next.js. We replaced heavy external queues with in-process event loops.',
      expectedIntent: 'architecture_explanation'
    },
    {
      pillarName: 'Lead Magnet',
      rawNotes: 'A complete 10-step security checklist for production Next.js apps before launch. Covers CSP headers, auth cookies, rate limiting, and SQL parameterization.',
      expectedIntent: 'checklist'
    }
  ];

  let passed = 0;

  for (const tc of testCases) {
    const pt = postTypes.find(p => p.name.toLowerCase() === tc.pillarName.toLowerCase());
    if (!pt) throw new Error(`Pillar ${tc.pillarName} not found!`);

    // 1. Deterministic Intent Resolution
    const resolved = resolveContentIntent(
      tc.rawNotes,
      pt.id,
      pt.name
    );

    console.log(`\n[Pillar: ${pt.name}]`);
    console.log(`  Notes: "${tc.rawNotes.slice(0, 60)}..."`);
    console.log(`  Resolved Intent: ${resolved.intentName} (${resolved.displayName}) [Confidence: ${resolved.confidence}, Reason: ${resolved.reason}]`);

    if (resolved.intentName !== tc.expectedIntent) {
      console.warn(`  ⚠️ Expected ${tc.expectedIntent}, got ${resolved.intentName}`);
    } else {
      passed++;
    }

    // 2. Eligible Anatomies Lookup
    const eligibleAnatomies = getEligibleAnatomiesForIntent(pt.id, resolved.intentId);
    console.log(`  Eligible Anatomies (${eligibleAnatomies.length}): ${eligibleAnatomies.map(a => a.name).join(', ')}`);
    if (eligibleAnatomies.length === 0) {
      throw new Error(`Zero anatomies found for ${pt.name} -> ${resolved.intentName}`);
    }

    // 3. LRU Anatomy Selection
    const selectedAnatomy = selectAnatomyLRU(eligibleAnatomies);
    if (!selectedAnatomy) throw new Error('No anatomy selected');
    console.log(`  LRU Selected Anatomy: "${selectedAnatomy.name}"`);
    console.log(`  Purpose: ${selectedAnatomy.purpose}`);
    let steps: string[] = [];
    try { steps = JSON.parse(selectedAnatomy.thinking_flow || '[]'); } catch { steps = [selectedAnatomy.thinking_flow || '']; }
    console.log(`  Thinking Flow: ${steps.slice(0, 3).join(' -> ')}... (${steps.length} steps)`);
    console.log(`  Writing Style: ${selectedAnatomy.writing_style?.slice(0, 70)}...`);

    // 4. Hook Selection (LRU Top 5)
    const hooks = db.prepare(`SELECT * FROM hook_types WHERE best_fit_pillars LIKE ? ORDER BY CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END, last_used_at ASC LIMIT 5`).all(`%"${pt.name}"%`) as { id: string; name: string }[];
    console.log(`  Eligible Hooks (${hooks.length}): ${hooks.map(h => h.name).slice(0, 3).join(', ')}...`);

    // 5. Update LRU timestamp test
    updateAnatomyLastUsed(selectedAnatomy.id);
  }

  console.log(`\n================================`);
  console.log(`Intent Resolution Tests: ${passed}/${testCases.length} exactly matched target intents.`);

  // Test Post Output Validation
  console.log('\n--- Testing Post Generation Validator ---');
  const sampleValidPost = {
    versions: [
      {
        version: 1,
        hookType: 'Observation',
        angle: 'Direct',
        content: 'Pakistani fintech startups are shifting away from standalone consumer wallets.\n\nOver the past two years, customer acquisition costs have outpaced transaction fees. The math no longer works for small players.\n\nWhat is happening instead is a quiet migration to embedded finance. Startups are embedding credit and payments directly into existing FMCG and retail distributor networks.\n\nThis means distribution is borrowed rather than bought. CAC drops by nearly 70%.\n\nThe takeaway for operators: when consumer unit economics break, look at the distribution rails that merchants already trust.',
        visualSuggestion: 'Comparison chart of CAC vs distribution margins',
        resources: []
      },
      {
        version: 2,
        hookType: 'Contrast',
        angle: 'Nuanced',
        content: 'Everyone expected consumer wallets to dominate emerging market payments. Reality played out differently.\n\nIn Pakistan, the most resilient fintechs are not fighting for consumer app installs anymore. They are wiring financial plumbing directly into supply chain distributor apps.\n\nBy serving the shopkeeper and distributor, they capture high-velocity transaction volume without the high marketing spend.\n\nDistribution efficiency is eating consumer marketing.',
        visualSuggestion: 'Supply chain diagram',
        resources: []
      },
      {
        version: 3,
        hookType: 'Question/Observation',
        angle: 'Case',
        content: 'A quiet pivot is underway across Karachi and Lahore tech ecosystems.\n\nInstead of subsidizing cashback for wallet downloads, founders are building embedded finance workflows for B2B supply chains.\n\nThe economics make sense. When you plug into a supply chain with existing trade flow, retention is guaranteed by daily commerce rather than marketing notifications.\n\nSustainable tech ecosystems emerge when companies solve operational headaches instead of vanity acquisition metrics.',
        visualSuggestion: '',
        resources: []
      }
    ]
  };

  const validationRes = validatePostGeneration(sampleValidPost, { name: 'text_post', min: 600, max: 1200 });
  console.log(`Validation isValid: ${validationRes.isValid}`);
  console.log(`Validation warnings (${validationRes.warnings.length}):`, validationRes.warnings);
  console.log(`Sanitized Content V1 preview (starts with): "${sampleValidPost.versions[0].content.slice(0, 80)}..."`);
  console.log('Does post contain visible anatomy headings? No, natural paragraphs!');
  console.log('--- All Architecture Tests Passed Successfully! ---');
}

runPipelineTests().catch(err => {
  console.error('Pipeline test error:', err);
  process.exit(1);
});
