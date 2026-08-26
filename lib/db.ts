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
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM post_types').get() as { c: number }).c;
  if (count > 0) return;

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
