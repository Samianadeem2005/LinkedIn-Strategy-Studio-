import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AVOID_WORDS } from '@/lib/constants';

export { DEFAULT_AVOID_WORDS };

const DB_PATH = path.join(process.cwd(), 'linkedin_content.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    seedIfEmpty(db);
    applyWritingStyleMigration(db);
    migrateAnatomyComponentsAndRemoveLru(db);
    deduplicatePostComponents(db);
    consolidateNamedPostComponents(db);
    migrateUniversalPostComponentsAndAnatomyJourneys(db);
    migrateGlobalUniversalPostComponents(db);
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
      applies_to_post_type_id TEXT REFERENCES post_types(id),
      entity_type TEXT NOT NULL DEFAULT 'anatomy'
    );

    CREATE TABLE IF NOT EXISTS post_components (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      component_type TEXT NOT NULL,
      purpose TEXT,
      instructions TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      post_type_id TEXT REFERENCES post_types(id)
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

    DROP TABLE IF EXISTS hook_bank;

    CREATE TABLE IF NOT EXISTS hook_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      angles TEXT NOT NULL,
      best_fit_pillars TEXT NOT NULL,
      created_at TEXT
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

  // Runtime migration — add visual_suggestions column to post_types
  if (!columns.includes('visual_suggestions')) {
    db.exec('ALTER TABLE post_types ADD COLUMN visual_suggestions TEXT');
  }

  // Seed default visual_suggestions for existing pillars
  const defaultVisuals: Record<string, string[]> = {
    'Value': ['Architecture diagram, code snippet screenshot, or comparison graphic highlighting key technical steps.'],
    'Lead Magnet': ['Resource preview mockups, template cheat-sheet screenshot, or a clean checklist infographic.'],
    'Authority': ['[Visual type + description] — Source: [exact URL of the original post/tweet/article/headline] (e.g. Screenshot of the LinkedIn post being referenced — Source: https://www.linkedin.com/posts/example-123456)'],
    'Personal': ['Behind-the-scenes workspace photo, personal building screenshot, or raw terminal / project milestone photo.'],
    'Showcase': [
      'Side-by-side LangGraph / system architecture diagram',
      'Before/after code comparison',
      'Real terminal execution log'
    ]
  };

  const existingPtsForVisuals = db.prepare('SELECT id, name, visual_suggestions FROM post_types').all() as { id: string; name: string; visual_suggestions: string | null }[];
  const updateVisualStmt = db.prepare('UPDATE post_types SET visual_suggestions = ? WHERE id = ?');
  existingPtsForVisuals.forEach(pt => {
    if (pt.name === 'Authority' || !pt.visual_suggestions) {
      if (defaultVisuals[pt.name]) {
        updateVisualStmt.run(JSON.stringify(defaultVisuals[pt.name]), pt.id);
      }
    }
  });

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

  // Runtime migration — add reason column to extraction_review for error tracking and LLM reasons
  if (!reviewColumns.includes('reason')) {
    db.exec("ALTER TABLE extraction_review ADD COLUMN reason TEXT DEFAULT NULL");
  }

  // Runtime migration — add about_me column to settings table for brand context
  const settingsColumns = (db.prepare("PRAGMA table_info(settings)").all() as { name: string }[]).map(c => c.name);
  if (!settingsColumns.includes('about_me')) {
    db.exec("ALTER TABLE settings ADD COLUMN about_me TEXT DEFAULT NULL");
  }

  const defaultAboutMe = "I am an AI Engineer (Software Engineering student, class of 2027) building in public, working with LLMs, multi-agent systems, RAG architectures, vector databases, and full-stack AI apps. I share my authentic learning and building journey on LinkedIn, using my real project (a company chatbot built with LangGraph, RAG, Text-to-SQL, and persistent memory) as my primary proof-of-work example.";
  db.exec(`UPDATE settings SET about_me = '${defaultAboutMe.replace(/'/g, "''")}' WHERE id = 1 AND (about_me IS NULL OR about_me = '')`);

  // Runtime migration — ensure tone_profile has vocabularyLevel and avoidWords
  const settingsRow = db.prepare('SELECT tone_profile FROM settings WHERE id = 1').get() as { tone_profile?: string } | undefined;
  if (settingsRow && settingsRow.tone_profile) {
    try {
      const parsed = JSON.parse(settingsRow.tone_profile);
      let updated = false;
      if (!parsed.vocabularyLevel) {
        parsed.vocabularyLevel = 'simple';
        updated = true;
      }
      if (!parsed.avoidWords || !Array.isArray(parsed.avoidWords) || parsed.avoidWords.length === 0) {
        parsed.avoidWords = DEFAULT_AVOID_WORDS;
        updated = true;
      }
      if (updated) {
        db.prepare('UPDATE settings SET tone_profile = ? WHERE id = 1').run(JSON.stringify(parsed));
      }
    } catch { /* ignore parse error */ }
  }


  // Runtime migration — create pillar_quotas table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS pillar_quotas (
      post_type_id TEXT PRIMARY KEY REFERENCES post_types(id),
      target_count INTEGER DEFAULT 1
    );
  `);

  // Runtime migration — create custom_pillar_rules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_pillar_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pillar_ids TEXT NOT NULL,
      target_count INTEGER DEFAULT 1,
      created_at TEXT
    );
  `);

  // Seed default custom_pillar_rules for existing post_types if table is empty
  const ruleCount = (db.prepare('SELECT COUNT(*) as c FROM custom_pillar_rules').get() as { c: number }).c;
  if (ruleCount === 0) {
    const existingPts = db.prepare('SELECT id, name FROM post_types').all() as { id: string; name: string }[];
    const quotaRows = db.prepare('SELECT post_type_id, target_count FROM pillar_quotas').all() as { post_type_id: string; target_count: number }[];
    const quotaMap: Record<string, number> = {};
    quotaRows.forEach(q => { quotaMap[q.post_type_id] = q.target_count; });

    const insertRule = db.prepare(`
      INSERT INTO custom_pillar_rules (id, name, pillar_ids, target_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      existingPts.forEach(pt => {
        insertRule.run(
          pt.id,
          pt.name,
          JSON.stringify([pt.id]),
          quotaMap[pt.id] ?? 1,
          new Date().toISOString()
        );
      });
    })();
  }

  // ── Runtime migration: content_intents table ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_intents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      post_type_id TEXT REFERENCES post_types(id),
      priority INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // ── Runtime migration: rich columns in post_anatomy ──────────────────────
  const anatomyCols = (db.prepare("PRAGMA table_info(post_anatomy)").all() as { name: string }[]).map(c => c.name);
  if (!anatomyCols.includes('name')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN name TEXT");
  }
  if (!anatomyCols.includes('purpose')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN purpose TEXT");
  }
  if (!anatomyCols.includes('thinking_flow')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN thinking_flow TEXT");
  }
  if (!anatomyCols.includes('writing_style')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN writing_style TEXT");
  }
  if (!anatomyCols.includes('constraints')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN constraints TEXT");
  }
  if (!anatomyCols.includes('entity_type')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'anatomy'");
  }
  if (!anatomyCols.includes('post_type_id')) {
    db.exec("ALTER TABLE post_anatomy ADD COLUMN post_type_id TEXT REFERENCES post_types(id)");
  }

  // Sync legacy columns where new columns are null
  db.exec("UPDATE post_anatomy SET name = section_name WHERE name IS NULL OR name = ''");
  db.exec("UPDATE post_anatomy SET post_type_id = applies_to_post_type_id WHERE post_type_id IS NULL AND applies_to_post_type_id IS NOT NULL");

  // ── Runtime migration: anatomy_intents junction table ────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS anatomy_intents (
      anatomy_id TEXT NOT NULL REFERENCES post_anatomy(id) ON DELETE CASCADE,
      intent_id TEXT NOT NULL REFERENCES content_intents(id) ON DELETE CASCADE,
      PRIMARY KEY (anatomy_id, intent_id)
    );
  `);

  // Seed content intents & rich anatomies if not already present
  seedContentIntentsAndAnatomies(db);
}

import { INITIAL_CONTENT_INTENTS, INITIAL_ANATOMIES } from '@/lib/initialContentData';

function seedContentIntentsAndAnatomies(db: Database.Database) {
  const existingPts = db.prepare('SELECT id, name FROM post_types').all() as { id: string; name: string }[];
  if (existingPts.length === 0) return;

  const pillarMap = new Map<string, string>();
  existingPts.forEach(pt => pillarMap.set(pt.name.toLowerCase().trim(), pt.id));

  // 1. Seed content intents if empty
  const intentCount = (db.prepare('SELECT COUNT(*) as c FROM content_intents').get() as { c: number }).c;
  const intentMap = new Map<string, string>(); // key: `${pillarId}:${intentName}` -> intentId

  if (intentCount === 0) {
    const insertIntent = db.prepare(`
      INSERT INTO content_intents (id, name, display_name, description, post_type_id, priority, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    db.transaction(() => {
      for (const item of INITIAL_CONTENT_INTENTS) {
        const pillarId = pillarMap.get(item.pillar.toLowerCase().trim());
        if (!pillarId) continue;
        const intentId = uuidv4();
        insertIntent.run(
          intentId,
          item.name,
          item.displayName,
          item.description,
          pillarId,
          item.priority,
          item.isDefault ? 1 : 0,
          now,
          now
        );
        intentMap.set(`${pillarId}:${item.name}`, intentId);
      }

    })();
  } else {
    // Populate intentMap from existing DB
    const allIntents = db.prepare('SELECT id, name, post_type_id FROM content_intents').all() as { id: string; name: string; post_type_id: string }[];
    allIntents.forEach(it => intentMap.set(`${it.post_type_id}:${it.name}`, it.id));
  }

  // 2. Seed rich anatomies if none exist with purpose
  const richAnatomyCount = (db.prepare("SELECT COUNT(*) as c FROM post_anatomy WHERE entity_type = 'anatomy' AND purpose IS NOT NULL").get() as { c: number }).c;
  if (richAnatomyCount === 0) {
    const insertAnatomy = db.prepare(`
      INSERT INTO post_anatomy (id, name, section_name, rule_description, purpose, thinking_flow, writing_style, constraints, order_index, post_type_id, applies_to_post_type_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAnatomyIntent = db.prepare(`
      INSERT OR IGNORE INTO anatomy_intents (anatomy_id, intent_id)
      VALUES (?, ?)
    `);

    db.transaction(() => {
      let orderIndex = 1;
      for (const item of INITIAL_ANATOMIES) {
        const pillarId = pillarMap.get(item.pillar.toLowerCase().trim());
        if (!pillarId) continue;
        const anatomyId = uuidv4();
        const flowJson = JSON.stringify(item.thinkingFlow);
        insertAnatomy.run(
          anatomyId,
          item.name,
          item.name,
          item.purpose,
          item.purpose,
          flowJson,
          item.writingStyle,
          item.constraints || null,
          orderIndex++,
          pillarId,
          pillarId
        );

        // Map to corresponding intents
        for (const intentName of item.intents) {
          const intentId = intentMap.get(`${pillarId}:${intentName}`);
          if (intentId) {
            insertAnatomyIntent.run(anatomyId, intentId);
          }
        }
      }
    })();
  }
}

function applyWritingStyleMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const migrationId = '2026-10-05-anatomy-writing-styles-and-global-mechanics';
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;

  const universalMechanics = new Map([
    ['One-Sentence Paragraph Rule', 'Format content using 1-2 sentence paragraphs and aggressive whitespace to eliminate dense text blocks, keeping sections light and effortlessly skimmable for mobile readers.'],
    ['Short Sentences & Value Density', 'Prefer short, clear sentences and frequent line breaks for mobile readability. Longer sentences are allowed when needed for natural flow or technical clarity.'],
    ['No vague claims', 'Concrete numbers/timeframes over vague claims.'],
    ['No Buzzwords', 'The draft contains no corporate buzzwords or filler.'],
    ['Promise', 'The body fully pays off the promise made in the hook.'],
    ['NO AI feel', 'The draft contains no generic AI phrases.\nThe post is free of spelling, grammar, and punctuation mistakes.'],
    ['Make Every Sentence Flow', 'Make Every Sentence Flow. Read each sentence and check how it connects to the next one. Add a clear connection. Do not use repeated openings, stacked fragments, or dramatic cadence to fake momentum.']
  ]);
  const updateMechanic = db.prepare('UPDATE writing_mechanics SET description = ?, prompt_directive = ? WHERE rule_name = ?');
  const disableRemoved = db.prepare('UPDATE writing_mechanics SET enabled = 0 WHERE rule_name IN (?, ?, ?, ?, ?, ?)');
  const updateAnatomy = db.prepare('UPDATE post_anatomy SET writing_style = ? WHERE name = ?');

  db.transaction(() => {
    for (const [name, text] of universalMechanics) updateMechanic.run(text, text, name);
    disableRemoved.run('Bold Contrast Framing', 'Actionable Takeaway Ending', 'Wave Line Structure', 'Groups of 3', 'No Orphan Words', 'Topic Chunking & Transition Connectors');
    for (const anatomy of INITIAL_ANATOMIES) updateAnatomy.run(anatomy.writingStyle, anatomy.name);
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
}

function migrateAnatomyComponentsAndRemoveLru(db: Database.Database) {
  const migrationId = '2026-10-06-separate-post-components-remove-lru';
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS anatomy_components (
      anatomy_id TEXT NOT NULL REFERENCES post_anatomy(id) ON DELETE CASCADE,
      component_id TEXT NOT NULL REFERENCES post_components(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (anatomy_id, component_id)
    )
  `);

  const componentNames = ['Hook', 'Rehook', 'Context', 'Breakdown', 'CTA', 'Lesson', 'Nudge', 'Pivot', 'Visual Suggestion'];
  const placeholders = componentNames.map(() => '?').join(', ');
  const legacyRows = db.prepare(`
    SELECT id, name, section_name, rule_description, order_index, post_type_id, applies_to_post_type_id
    FROM post_anatomy
    WHERE name IN (${placeholders}) OR section_name IN (${placeholders})
  `).all(...componentNames, ...componentNames) as {
    id: string; name: string | null; section_name: string; rule_description: string;
    order_index: number; post_type_id: string | null; applies_to_post_type_id: string | null;
  }[];
  const componentIds = new Map<string, string>();

  db.transaction(() => {
    for (const row of legacyRows) {
      const name = row.name || row.section_name;
      const pillarId = row.post_type_id || row.applies_to_post_type_id || null;
      const key = `${pillarId || 'global'}:${name}`;
      if (componentIds.has(key)) continue;
      const id = uuidv4();
      db.prepare(`
        INSERT INTO post_components
          (id, name, description, component_type, purpose, instructions, order_index, enabled, post_type_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(id, name, row.rule_description, name.toLowerCase().replace(/\s+/g, '_'), row.rule_description, row.rule_description, row.order_index, pillarId);
      componentIds.set(key, id);
    }

        const anatomies = db.prepare("SELECT id, post_type_id, applies_to_post_type_id FROM post_anatomy WHERE entity_type = 'anatomy'")
      .all() as { id: string; post_type_id: string | null; applies_to_post_type_id: string | null }[];
    const mapComponent = db.prepare('INSERT OR IGNORE INTO anatomy_components (anatomy_id, component_id, order_index) VALUES (?, ?, ?)');
    for (const anatomy of anatomies) {
      const pillarId = anatomy.post_type_id || anatomy.applies_to_post_type_id;
      for (const row of legacyRows) {
        const componentPillar = row.post_type_id || row.applies_to_post_type_id;
        if (componentPillar && componentPillar !== pillarId) continue;
        const name = row.name || row.section_name;
        const id = componentIds.get(`${componentPillar || 'global'}:${name}`);
        if (id) mapComponent.run(anatomy.id, id, row.order_index);
      }
    }

    const richRows = db.prepare("SELECT id, thinking_flow FROM post_anatomy WHERE entity_type = 'anatomy' AND thinking_flow IS NOT NULL")
      .all() as { id: string; thinking_flow: string }[];
    const updateFlow = db.prepare('UPDATE post_anatomy SET thinking_flow = ? WHERE id = ?');
    for (const row of richRows) {
      try {
        const parsed = JSON.parse(row.thinking_flow);
        if (!Array.isArray(parsed) || parsed.some(step => typeof step !== 'string')) continue;
        updateFlow.run(JSON.stringify(parsed.map((instruction: string, index: number) => ({
          name: `Step ${index + 1}`,
          instruction,
          purpose: ''
        }))), row.id);
      } catch {
        // Keep malformed legacy data unchanged so it can still be edited from the UI.
      }
    }

    db.prepare(`
      DELETE FROM post_anatomy
      WHERE name IN (${placeholders}) OR section_name IN (${placeholders})
    `).run(...componentNames, ...componentNames);

    const anatomyColumns = (db.prepare('PRAGMA table_info(post_anatomy)').all() as { name: string }[]).map(c => c.name);
    if (anatomyColumns.includes('last_used_at')) db.exec('ALTER TABLE post_anatomy DROP COLUMN last_used_at');
    const hookColumns = (db.prepare('PRAGMA table_info(hook_types)').all() as { name: string }[]).map(c => c.name);
    if (hookColumns.includes('last_used_at')) db.exec('ALTER TABLE hook_types DROP COLUMN last_used_at');
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
}

function deduplicatePostComponents(db: Database.Database) {
  const migrationId = '2026-10-06-deduplicate-post-components';
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;

  db.transaction(() => {
    const duplicates = db.prepare(`
      SELECT name, component_type, instructions, MIN(id) AS canonical_id
      FROM post_components
      GROUP BY name, component_type, instructions
      HAVING COUNT(*) > 1
    `).all() as { name: string; component_type: string; instructions: string; canonical_id: string }[];
    const findIds = db.prepare('SELECT id FROM post_components WHERE name = ? AND component_type = ? AND instructions = ?');
    const mappings = db.prepare('SELECT anatomy_id, order_index FROM anatomy_components WHERE component_id = ?');
    const addMapping = db.prepare('INSERT OR IGNORE INTO anatomy_components (anatomy_id, component_id, order_index) VALUES (?, ?, ?)');
    const removeMappings = db.prepare('DELETE FROM anatomy_components WHERE component_id = ?');
    const removeComponent = db.prepare('DELETE FROM post_components WHERE id = ?');

    for (const duplicate of duplicates) {
      const ids = (findIds.all(duplicate.name, duplicate.component_type, duplicate.instructions) as { id: string }[])
        .map(row => row.id);
      for (const id of ids) {
        if (id === duplicate.canonical_id) continue;
        for (const mapping of mappings.all(id) as { anatomy_id: string; order_index: number }[]) {
          addMapping.run(mapping.anatomy_id, duplicate.canonical_id, mapping.order_index);
        }
        removeMappings.run(id);
        removeComponent.run(id);
      }
    }
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
}

function consolidateNamedPostComponents(db: Database.Database) {
  const migrationId = '2026-10-06-consolidate-named-post-components';
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;

  db.transaction(() => {
    const groups = db.prepare(`
      SELECT name, component_type
      FROM post_components
      GROUP BY name, component_type
      HAVING COUNT(*) > 1
    `).all() as { name: string; component_type: string }[];
    const find = db.prepare(`
      SELECT id, post_type_id
      FROM post_components
      WHERE name = ? AND component_type = ?
      ORDER BY CASE WHEN post_type_id IS NULL THEN 0 ELSE 1 END, id
    `);
    const mappings = db.prepare('SELECT anatomy_id, order_index FROM anatomy_components WHERE component_id = ?');
    const addMapping = db.prepare('INSERT OR IGNORE INTO anatomy_components (anatomy_id, component_id, order_index) VALUES (?, ?, ?)');
    const removeMappings = db.prepare('DELETE FROM anatomy_components WHERE component_id = ?');
    const removeComponent = db.prepare('DELETE FROM post_components WHERE id = ?');

    for (const group of groups) {
      const rows = find.all(group.name, group.component_type) as { id: string; post_type_id: string | null }[];
      const canonicalId = rows[0].id;
      for (const row of rows.slice(1)) {
        for (const mapping of mappings.all(row.id) as { anatomy_id: string; order_index: number }[]) {
          addMapping.run(mapping.anatomy_id, canonicalId, mapping.order_index);
        }
        removeMappings.run(row.id);
        removeComponent.run(row.id);
      }
    }
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
}

function migrateUniversalPostComponentsAndAnatomyJourneys(db: Database.Database) {
  const migrationId = '2026-10-06-universal-post-components-anatomy-journeys';
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;

  const removedNames = ['Rehook', 'Pivot', 'Lesson', 'Nudge'];
  db.transaction(() => {
    db.prepare(`
      UPDATE post_components
      SET name = 'Body', component_type = 'body'
      WHERE name = 'Breakdown'
    `).run();
    const removedPlaceholders = removedNames.map(() => '?').join(', ');
    db.prepare(`
      DELETE FROM anatomy_components
      WHERE component_id IN (
        SELECT id FROM post_components WHERE name IN (${removedPlaceholders})
      )
    `).run(...removedNames);
    db.prepare(`DELETE FROM post_components WHERE name IN (${removedPlaceholders})`).run(...removedNames);

    const anatomyRows = db.prepare(`
      SELECT id, name, thinking_flow
      FROM post_anatomy
      WHERE entity_type = 'anatomy'
        AND name IN ('Turning Point', 'Failure Story', 'Before / After', 'Contrarian Opinion',
                     'Problem → Why → Fix', 'Architecture Reveal', 'Comparison', 'Cheat Sheet',
                     'Checklist', 'Industry Observation', 'Build Story', 'Build Failure')
    `).all() as { id: string; name: string; thinking_flow: string | null }[];
    const updateFlow = db.prepare('UPDATE post_anatomy SET thinking_flow = ? WHERE id = ?');

    const additions: Record<string, string> = {
      'Turning Point': 'Reconnect the realization and changed approach to the reader’s situation so the insight leads to useful action.',
      'Failure Story': 'State the hard-won lesson and the changed behavior another builder can reuse.',
      'Before / After': 'Turn the reflection into a practical implication for someone facing the same friction.',
      'Contrarian Opinion': 'State the practical behavior or decision that should change because of this strategic shift.',
      'Problem → Why → Fix': 'Clarify the decision rule for applying the fix in a similar situation.',
      'Architecture Reveal': 'Explain the operational behavior or implementation decision this architecture should change.',
      'Comparison': 'End with the decision heuristic and the action it implies for the reader’s context.',
      'Cheat Sheet': 'Make the reference rules actionable by stating what behavior each rule should change.',
      'Checklist': 'Close by stating the action the reader should take after completing the checklist.',
      'Industry Observation': 'Explain what behavior or decision should change because of this broader implication.',
      'Build Story': 'State when another builder should reuse the technical lesson from this build.',
      'Build Failure': 'State the changed engineering behavior the hard-won rule should produce.'
    };

    for (const anatomy of anatomyRows) {
      if (!anatomy.thinking_flow) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(anatomy.thinking_flow);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      const steps = parsed.map((step, index) => typeof step === 'string'
        ? { name: `Step ${index + 1}`, instruction: step, purpose: '' }
        : step as { name?: string; instruction?: string; purpose?: string });
      const addition = additions[anatomy.name];
      if (addition && !steps.some(step => step.instruction === addition)) {
        const last = steps[steps.length - 1];
        steps[steps.length - 1] = {
          ...last,
          instruction: `${last.instruction || ''} ${addition}`.trim()
        };
      }
      updateFlow.run(JSON.stringify(steps), anatomy.id);
    }
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
}

// ── Anatomy & Intent Queries ───────────────────────────────────────────────

export interface RichAnatomy {
  id: string;
  name: string;
  section_name?: string;
  purpose: string;
  thinking_flow: string; // JSON array of steps
  writing_style: string;
  constraints?: string | null;
  order_index: number;
  post_type_id: string;
  applies_to_post_type_id?: string | null;
  intent_ids?: string[];
  intents?: { id: string; name: string; display_name: string }[];
}

export interface ContentIntentRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  post_type_id: string;
  post_type_name?: string;
  priority: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export function getContentIntents(postTypeId?: string): ContentIntentRow[] {
  const db = getDb();
  let query = `
    SELECT ci.*, pt.name as post_type_name
    FROM content_intents ci
    LEFT JOIN post_types pt ON ci.post_type_id = pt.id
  `;
  const params: unknown[] = [];
  if (postTypeId) {
    query += ' WHERE ci.post_type_id = ?';
    params.push(postTypeId);
  }
  query += ' ORDER BY ci.priority ASC, ci.name ASC';
  return db.prepare(query).all(...params) as ContentIntentRow[];
}

export function getEligibleAnatomiesForIntent(postTypeId: string, intentId?: string | null): RichAnatomy[] {
  const db = getDb();
  if (!intentId) return [];
  return db.prepare(`
    SELECT DISTINCT pa.*
    FROM post_anatomy pa
    JOIN anatomy_intents ai ON pa.id = ai.anatomy_id
    WHERE ai.intent_id = ?
      AND (pa.post_type_id = ? OR pa.applies_to_post_type_id = ?)
      AND pa.entity_type = 'anatomy'
    ORDER BY pa.order_index ASC, pa.name ASC
  `).all(intentId, postTypeId, postTypeId) as RichAnatomy[];
}

export interface PostComponent {
  id: string;
  name: string;
  description: string | null;
  component_type: string;
  purpose: string | null;
  instructions: string;
  order_index: number;
  enabled: number;
}

export function getUniversalPostComponents(): PostComponent[] {
  const db = getDb();
  return db.prepare(`
    SELECT pc.*
    FROM post_components pc
    WHERE pc.enabled = 1
    ORDER BY CASE pc.name
      WHEN 'Hook' THEN 0
      WHEN 'Context' THEN 1
      WHEN 'Body' THEN 2
      WHEN 'CTA' THEN 3
      WHEN 'Visual Suggestion' THEN 4
      ELSE 99
    END
  `).all() as PostComponent[];
}

function migrateGlobalUniversalPostComponents(db: Database.Database) {
  const migrationId = '2026-10-06-global-universal-post-components';
  db.prepare('DROP TABLE IF EXISTS anatomy_components').run();
  if (db.prepare('SELECT 1 FROM system_migrations WHERE id = ?').get(migrationId)) return;

  const allowed = ['Hook', 'Context', 'Body', 'CTA', 'Visual Suggestion'];
  db.transaction(() => {
    const placeholders = allowed.map(() => '?').join(', ');
    db.prepare(`DELETE FROM post_components WHERE name NOT IN (${placeholders})`).run(...allowed);
    const canonical = new Map<string, string>();
    const rows = db.prepare('SELECT id, name FROM post_components ORDER BY id').all() as { id: string; name: string }[];
    for (const row of rows) {
      if (canonical.has(row.name)) {
        db.prepare('DELETE FROM post_components WHERE id = ?').run(row.id);
      } else {
        canonical.set(row.name, row.id);
      }
    }
    const update = db.prepare('UPDATE post_components SET component_type = ?, order_index = ?, enabled = 1 WHERE id = ?');
    allowed.forEach((name, index) => {
      const id = canonical.get(name);
      if (id) update.run(name.toLowerCase().replace(/\s+/g, '_'), index, id);
    });
    const columns = (db.prepare('PRAGMA table_info(post_components)').all() as { name: string }[]).map(c => c.name);
    if (columns.includes('post_type_id')) {
      db.exec(`
        CREATE TABLE post_components_global (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          component_type TEXT NOT NULL,
          purpose TEXT,
          instructions TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO post_components_global
          (id, name, description, component_type, purpose, instructions, order_index, enabled)
        SELECT id, name, description, component_type, purpose, instructions, order_index, enabled
        FROM post_components;
        DROP TABLE post_components;
        ALTER TABLE post_components_global RENAME TO post_components;
      `);
    }
    db.prepare('INSERT INTO system_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
  })();
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
        languageMix: 'Clear, professional English',
        vocabularyLevel: 'simple',
        avoidWords: DEFAULT_AVOID_WORDS
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

  // Seed hook types if empty
  const hookTypesCount = (db.prepare('SELECT COUNT(*) as c FROM hook_types').get() as { c: number }).c;
  if (hookTypesCount === 0) {
    const defaultHookTypes = [
      {
        name: 'Misconception',
        description: 'Challenge a false belief the reader holds',
        angles: JSON.stringify(['Call out a false belief your ideal client has', 'State the false assumption they have', 'Challenge what they thought was true']),
        best_fit_pillars: JSON.stringify(['Value', 'Authority'])
      },
      {
        name: 'Transformation',
        description: 'Show contrast between past struggle and present success',
        angles: JSON.stringify(['Show where you were vs where you are now', 'Highlight the gap between before and after', 'Help readers see themselves in your journey']),
        best_fit_pillars: JSON.stringify(['Personal'])
      },
      {
        name: 'Objection',
        description: 'Directly confront target audience doubts',
        angles: JSON.stringify(['Quote the exact objection prospects have', 'Share the conversation you had with them', 'Address the doubt to show you understand']),
        best_fit_pillars: JSON.stringify(['Value', 'Authority'])
      },
      {
        name: 'Process',
        description: 'Outline a clear step-by-step method to solve a pain point',
        angles: JSON.stringify(['Lead with the pain point you\'re solving', 'Offer a clear step-by-step solution', 'Number your steps to make it actionable']),
        best_fit_pillars: JSON.stringify(['Lead Magnet'])
      },
      {
        name: 'Client story',
        description: 'Narrate real client results and transformation',
        angles: JSON.stringify(['Start with the challenge your client faced', 'Then show the desired outcome they achieved', 'Make similar prospects picture their success']),
        best_fit_pillars: JSON.stringify(['Showcase'])
      },
      {
        name: 'Industry take',
        description: 'Share a bold perspective on industry shifts',
        angles: JSON.stringify(['State how your industry/niche has changed', 'Add that it\'s actually a good thing', 'Make them want to know why you think so']),
        best_fit_pillars: JSON.stringify(['Value', 'Authority'])
      },
      {
        name: 'Framework',
        description: 'Introduce a high-value structured solution or cheat sheet',
        angles: JSON.stringify(['Position it as the only solution they need', 'Add a save trigger to signal its value', 'Make it feel like a quick win for them']),
        best_fit_pillars: JSON.stringify(['Lead Magnet'])
      },
      {
        name: 'Contrast',
        description: 'Highlight common mistakes vs the right strategy',
        angles: JSON.stringify(['Point out what everyone seems to do', 'Show what they should be doing instead', 'Highlight the disconnect between them']),
        best_fit_pillars: JSON.stringify(['Value', 'Authority'])
      },
      {
        name: 'Lesson',
        description: 'Reflect on a setback and key takeaways',
        angles: JSON.stringify(['Open with the struggle or setback you faced', 'Share the specific lesson you learned from it', 'Make it relatable so readers feel inspired']),
        best_fit_pillars: JSON.stringify(['Personal'])
      },
      {
        name: 'Case study',
        description: 'Detail proof of performance with metrics and timeline',
        angles: JSON.stringify(['State how you helped a client achieve results', 'Include a specific metric and a timeframe', 'Connect with prospects wanting that result']),
        best_fit_pillars: JSON.stringify(['Showcase'])
      }
    ];
    const insertHookType = db.prepare('INSERT INTO hook_types (id, name, description, angles, best_fit_pillars, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const now = new Date().toISOString();
    for (const ht of defaultHookTypes) {
      insertHookType.run(uuidv4(), ht.name, ht.description, ht.angles, ht.best_fit_pillars, now);
    }
  }
}
