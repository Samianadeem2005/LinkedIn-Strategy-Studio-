import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'linkedin_content.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    seedIfEmpty(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      frequency TEXT DEFAULT 'daily',
      tone_profile TEXT,
      anatomy_scope TEXT DEFAULT 'global'
    );

    CREATE TABLE IF NOT EXISTS post_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dos TEXT NOT NULL,
      donts TEXT NOT NULL,
      core_focus TEXT
    );

    CREATE TABLE IF NOT EXISTS post_anatomy (
      id TEXT PRIMARY KEY,
      section_name TEXT NOT NULL,
      rule_description TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      applies_to_post_type_id TEXT REFERENCES post_types(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_mapping (
      day_of_week TEXT PRIMARY KEY,
      post_type_id TEXT REFERENCES post_types(id),
      series_length INTEGER DEFAULT 1,
      is_continuation_of TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_plans (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      start_date TEXT,
      duration_days INTEGER,
      source_raw_dump TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_entries (
      id TEXT PRIMARY KEY,
      plan_id TEXT REFERENCES calendar_plans(id),
      day_index INTEGER,
      date TEXT,
      post_type_id TEXT REFERENCES post_types(id),
      post_title TEXT,
      topics_covered TEXT,
      bridge_logic TEXT,
      visual_suggestion TEXT,
      is_authority_borrow INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned'
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      calendar_entry_id TEXT REFERENCES calendar_entries(id),
      date TEXT,
      post_type_id TEXT REFERENCES post_types(id),
      series_part TEXT,
      raw_notes_used TEXT,
      topic_summary TEXT,
      versions TEXT,
      selected_version INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_dumps (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS extraction_review (
      id TEXT PRIMARY KEY,
      dump_id TEXT REFERENCES knowledge_dumps(id),
      heading TEXT NOT NULL,
      point_text TEXT NOT NULL,
      target_table TEXT NOT NULL,
      is_new_category INTEGER DEFAULT 0,
      target_row_id TEXT,
      user_decision TEXT DEFAULT 'pending',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS writing_mechanics (
      id TEXT PRIMARY KEY,
      rule_name TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt_directive TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hook_bank (
      id TEXT PRIMARY KEY,
      hook_text TEXT NOT NULL,
      category TEXT,
      source TEXT,
      used_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voice_examples (
      id TEXT PRIMARY KEY,
      example_text TEXT NOT NULL,
      notes TEXT
    );
  `);

  // Runtime migration — add core_focus column to existing databases that don't have it yet
  const columns = (db.prepare("PRAGMA table_info(post_types)").all() as { name: string }[]).map(c => c.name);
  if (!columns.includes('core_focus')) {
    db.exec('ALTER TABLE post_types ADD COLUMN core_focus TEXT');
  }

  // Runtime migration — add visual_suggestion column to calendar_entries
  const calColumns = (db.prepare("PRAGMA table_info(calendar_entries)").all() as { name: string }[]).map(c => c.name);
  if (!calColumns.includes('visual_suggestion')) {
    db.exec('ALTER TABLE calendar_entries ADD COLUMN visual_suggestion TEXT');
  }

  // Runtime migration — add clean_summary column to knowledge_dumps
  const dumpColumns = (db.prepare("PRAGMA table_info(knowledge_dumps)").all() as { name: string }[]).map(c => c.name);
  if (!dumpColumns.includes('clean_summary')) {
    db.exec('ALTER TABLE knowledge_dumps ADD COLUMN clean_summary TEXT');
  }

  // Runtime migration — add apply_mode column to extraction_review
  const reviewColumns = (db.prepare("PRAGMA table_info(extraction_review)").all() as { name: string }[]).map(c => c.name);
  if (!reviewColumns.includes('apply_mode')) {
    db.exec("ALTER TABLE extraction_review ADD COLUMN apply_mode TEXT DEFAULT 'merge'");
  }

  // Runtime migration — add suggested_order_index column to extraction_review for smart anatomy ordering
  if (!reviewColumns.includes('suggested_order_index')) {
    db.exec("ALTER TABLE extraction_review ADD COLUMN suggested_order_index INTEGER DEFAULT NULL");
  }
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM post_types').get() as { c: number }).c;
  if (count === 0) {
    // Seed settings
    db.prepare(`INSERT OR IGNORE INTO settings (id, frequency, anatomy_scope, tone_profile) VALUES (1, 'daily', 'global', ?)`).run(
      JSON.stringify({
        formality: 'mixed',
        sentenceLength: 'short',
        bannedPhrases: ['In today\'s fast-paced world', 'Let\'s dive in', 'Game changer', 'Excited to share'],
        languageMix: 'Clear, professional English'
      })
    );

    // Seed post types
    const postTypes = [
      {
        id: uuidv4(),
        name: 'Value',
        core_focus: 'Educate the audience on one specific concept, tool, or technique drawn from your own work or study. The reader should finish knowing something actionable they did not know before. This is pure knowledge transfer — no selling, no storytelling detour.',
        dos: JSON.stringify(['Teach one concrete concept clearly', 'Use numbered lists or steps', 'End with a takeaway or principle', 'Include a real example']),
        donts: JSON.stringify(['Be vague or generic', 'Skip the practical application', 'Use corporate jargon', 'Make it longer than necessary'])
      },
      {
        id: uuidv4(),
        name: 'Lead Magnet',
        core_focus: 'Drive a specific engagement action (comment, DM, save) by offering a high-value resource — checklist, template, framework, or guide. The post exists to deliver leads and grow your list. Every word should funnel toward the CTA.',
        dos: JSON.stringify(['Offer a specific resource, checklist, or framework', 'Tease the value clearly in the hook', 'Ask for engagement to receive it', 'Make the offer feel exclusive and time-relevant']),
        donts: JSON.stringify(['Be salesy or pushy', 'Hide what the resource actually is', 'Offer something too generic', 'Forget to include a clear CTA'])
      },
      {
        id: uuidv4(),
        name: 'Authority',
        core_focus: 'Position yourself as a domain expert by referencing established thought leaders, research, or institutions — and adding your own synthesis, critique, or application on top. The goal is borrowed credibility amplified by your unique perspective. Name-dropping alone is not enough; your insight is the point.',
        dos: JSON.stringify(['Reference credible sources or established experts', 'Show your own synthesis or angle on the topic', 'Demonstrate domain expertise', 'Connect the reference to your own work or experience']),
        donts: JSON.stringify(['Just summarize without adding your own insight', 'Over-rely on name-dropping', 'Be sycophantic toward the authority', 'Miss the bridge to your own audience\'s context'])
      },
      {
        id: uuidv4(),
        name: 'Personal',
        core_focus: 'Build human connection and relatability by sharing a real story, honest reflection, or personal moment tied to your professional journey. The reader should feel like they know you better and trust you more after reading it. No generic inspiration — only specific, earned insight.',
        dos: JSON.stringify(['Share a real story or honest reflection', 'Be specific about the situation and what you learned', 'Show vulnerability or growth', 'Connect the personal moment to a professional insight']),
        donts: JSON.stringify(['Be overly dramatic or attention-seeking', 'Share without a point or takeaway', 'Make it too long or self-indulgent', 'Avoid a real lesson or reflection'])
      }
    ];

    const insertPT = db.prepare('INSERT INTO post_types (id, name, dos, donts, core_focus) VALUES (?, ?, ?, ?, ?)');
    for (const pt of postTypes) {
      insertPT.run(pt.id, pt.name, pt.dos, pt.donts, pt.core_focus);
    }

    // Seed anatomy
    const anatomy = [
      { section_name: 'Hook', rule_description: 'First 1-2 lines that stop the scroll. Use a bold claim, question, or surprising stat. Must work standalone as a preview snippet.', order_index: 0 },
      { section_name: 'Context', rule_description: 'Brief setup (2-3 sentences) explaining why this matters now or what problem it solves. Bridge from hook to main content.', order_index: 1 },
      { section_name: 'Breakdown', rule_description: 'The main content body. Use numbered steps, bullet points, or mini-paragraphs. This is where the real value is delivered.', order_index: 2 },
      { section_name: 'CTA', rule_description: 'One clear call-to-action. Ask a specific question, invite a specific response, or direct to a specific resource. Never use generic "let me know your thoughts."', order_index: 3 },
      { section_name: 'Visual Suggestion', rule_description: 'Concrete visual recommendation: exactly what image, diagram, screenshot, or graphic to create. Be specific (e.g. "Code snippet showing X" not just "add an image").', order_index: 4 }
    ];

    const insertAnatomyStmt = db.prepare('INSERT INTO post_anatomy (id, section_name, rule_description, order_index, applies_to_post_type_id) VALUES (?, ?, ?, ?, NULL)');
    for (const section of anatomy) {
      insertAnatomyStmt.run(uuidv4(), section.section_name, section.rule_description, section.order_index);
    }

    // Seed weekly mapping defaults
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const typeNames = ['Value', 'Lead Magnet', 'Authority', 'Personal', 'Value', 'Lead Magnet', 'Authority'];
    const insertWM = db.prepare('INSERT OR IGNORE INTO weekly_mapping (day_of_week, post_type_id, series_length) VALUES (?, ?, 1)');
    for (let i = 0; i < days.length; i++) {
      const pt = postTypes.find(p => p.name === typeNames[i]);
      if (pt) insertWM.run(days[i], pt.id);
    }
  }

  // Seed writing mechanics if empty
  const mechCount = (db.prepare('SELECT COUNT(*) as c FROM writing_mechanics').get() as { c: number }).c;
  if (mechCount === 0) {
    const defaultMechanics = [
      {
        rule_name: 'One-Sentence Paragraph Rule',
        description: 'Keep lines short and scannable. Use 1-2 sentence paragraphs to maximize readability on mobile screens.',
        prompt_directive: 'Format content with 1-2 sentence short paragraphs and single line breaks between thoughts. Avoid dense blocks of text.',
        order_index: 0
      },
      {
        rule_name: 'Bold Contrast Framing',
        description: 'Use contrasting framework pairs like "Old Way vs New Way" or "Myth vs Reality" for high engagement.',
        prompt_directive: 'Use explicit contrast pairs (e.g. "Old way: X. New way: Y.") to highlight core transitions.',
        order_index: 1
      },
      {
        rule_name: 'Actionable Takeaway Ending',
        description: 'Every post must conclude with a sharp, practical rule or golden principle before the CTA.',
        prompt_directive: 'Ensure the final takeaway is a standalone, memorable principle that summarizes the lesson.',
        order_index: 2
      }
    ];
    const insertMech = db.prepare('INSERT INTO writing_mechanics (id, rule_name, description, prompt_directive, enabled, order_index) VALUES (?, ?, ?, ?, 1, ?)');
    for (const m of defaultMechanics) {
      insertMech.run(uuidv4(), m.rule_name, m.description, m.prompt_directive, m.order_index);
    }
  }

  // Seed hook bank if empty
  const hookCount = (db.prepare('SELECT COUNT(*) as c FROM hook_bank').get() as { c: number }).c;
  if (hookCount === 0) {
    const defaultHooks = [
      { hook_text: 'Most developers spend weeks building X. Here is how we solved it in 48 hours.', category: 'contrarian', source: 'Default Playbook' },
      { hook_text: '90% of RAG pipelines break in production because of this single mistake:', category: 'stat', source: 'Default Playbook' },
      { hook_text: 'What if you could automate your entire content workflow without sacrificing quality?', category: 'question', source: 'Default Playbook' },
      { hook_text: 'We refactored our entire agent architecture last week. Here is what broke (and what worked):', category: 'story', source: 'Default Playbook' },
      { hook_text: 'Stop using generic prompts for complex reasoning. Do this instead:', category: 'contrarian', source: 'Default Playbook' }
    ];
    const insertHook = db.prepare('INSERT INTO hook_bank (id, hook_text, category, source, used_count) VALUES (?, ?, ?, ?, 0)');
    for (const h of defaultHooks) {
      insertHook.run(uuidv4(), h.hook_text, h.category, h.source);
    }
  }
}

