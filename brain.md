# LinkedIn Content OS — Master Architecture & Implementation Knowledge Base (`brain.md`)

This document serves as the complete, self-contained technical blueprint, schema documentation, prompt specification, and operational guide for **LinkedIn Content OS**. It contains all architectural context, database schemas, validation rules, AI prompt structures, API contracts, and workflow logic required to understand, maintain, or rebuild this system.

---

## 1. System Philosophy & Core Architectural Rules

1. **Automation Boundary**: AI operates as a high-velocity drafting co-pilot. Human oversight is mandatory before publishing. The app structures raw inputs into structured LinkedIn posts, but never auto-publishes without human approval.
2. **Server-Side Security**: All AI generation logic and API keys (`GEMINI_API_KEY`) reside strictly on the server (`/app/api/...`). The client browser never sees the API key.
3. **Multi-Key API Rotation & Model Fallback**: Supports multi-key rotation via comma-separated keys (`GEMINI_API_KEY=key1,key2,key3`). The system automatically rotates keys upon rate limits (429) or server errors (503) across multi-pass retries (`lib/gemini.ts`).
4. **Data-Driven Rules Engine**: Content structures, post types, DOs/DON'Ts, Core Focus statements, post anatomy sections, writing mechanics, hook types, and tone profiles are stored entirely in a local SQLite database (`linkedin_content.db`).
5. **Dual Validation Gates**: Business rules (e.g., mandatory DOs, DON'Ts, Core Focus, and Weekly Quotas) are enforced on both the client (UI inline warnings and confirmation modals) and the server.
6. **Resolution Order Enforcement**: Daily post strategy follows a deterministic 3-tier fallback hierarchy:
   - **Tier 1 (Calendar Plan)**: Date-specific planned entry from Calendar Maker.
   - **Tier 2 (Weekly Schedule)**: Fallback template mapped by day of the week (e.g., Monday = Value).
   - **Tier 3 (Manual Selection)**: Direct manual dropdown override in the Studio.
7. **Vocabulary Simplicity Directive**: Enforces simple, plain everyday vocabulary across all AI generations, avoiding formal essay jargon (e.g., prohibiting words like `resilience`, `predictable`, `leverage`, `seamless`, `utilize`, `delve`).

---

## 2. Complete Database Schema (`better-sqlite3`)

The application utilizes a local SQLite database located at `./linkedin_content.db`. Native module handling in Next.js is configured via `serverExternalPackages: ['better-sqlite3']` in `next.config.ts`.

```sql
-- 1. App-wide Settings & Tone Profile
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  frequency TEXT DEFAULT 'daily',
  tone_profile TEXT, -- JSON: { formality, sentenceLength, bannedPhrases, languageMix, vocabularyLevel, avoidWords }
  anatomy_scope TEXT DEFAULT 'global', -- 'global' | 'per_post_type'
  about_me TEXT -- Personal brand bio for prompt context
);

-- 2. Post Types / Content Pillars
CREATE TABLE IF NOT EXISTS post_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dos TEXT NOT NULL,                -- JSON array of strings
  donts TEXT NOT NULL,              -- JSON array of strings
  core_focus TEXT,                  -- Detailed description of fundamental purpose and intent
  visual_suggestions TEXT          -- JSON array or string of visual recommendations
);

-- 3. Post Anatomy Sections
CREATE TABLE IF NOT EXISTS post_anatomy (
  id TEXT PRIMARY KEY,
  section_name TEXT NOT NULL,
  rule_description TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  applies_to_post_type_id TEXT REFERENCES post_types(id) -- NULL = global, specific ID = per-post-type override
);

-- 4. Weekly Pillar Schedule & Quotas
CREATE TABLE IF NOT EXISTS weekly_mapping (
  day_of_week TEXT PRIMARY KEY, -- 'Monday', 'Tuesday', ...
  post_type_id TEXT REFERENCES post_types(id),
  series_length INTEGER DEFAULT 1,
  is_continuation_of TEXT
);

CREATE TABLE IF NOT EXISTS pillar_quotas (
  post_type_id TEXT PRIMARY KEY REFERENCES post_types(id),
  target_count INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS custom_pillar_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pillar_ids TEXT NOT NULL, -- JSON array of post_type_ids for merged/hybrid rules
  target_count INTEGER DEFAULT 1,
  created_at TEXT
);

-- 5. Hook Formulas & Bank
CREATE TABLE IF NOT EXISTS hook_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  angles TEXT NOT NULL,            -- JSON array of angle formulas
  best_fit_pillars TEXT NOT NULL,  -- JSON array of pillar names
  last_used_at TEXT                -- Timestamp of last usage for LRU rotation
);

-- 6. Writing Mechanics Directives
CREATE TABLE IF NOT EXISTS writing_mechanics (
  id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt_directive TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL
);

-- 7. Multi-Day Calendar Plans & Entries
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
  topics_covered TEXT,             -- JSON array of strings
  bridge_logic TEXT,
  visual_suggestion TEXT,
  is_authority_borrow INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned'
);

-- 8. Knowledge Ingestion & Semantic Deduplication Pipeline
CREATE TABLE IF NOT EXISTS knowledge_dumps (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  clean_summary TEXT,
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
  apply_mode TEXT DEFAULT 'merge',
  suggested_order_index INTEGER,
  reason TEXT,
  user_decision TEXT DEFAULT 'pending',
  created_at TEXT
);

-- 9. Generated & Saved Posts History
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  calendar_entry_id TEXT REFERENCES calendar_entries(id),
  date TEXT,
  post_type_id TEXT REFERENCES post_types(id),
  series_part TEXT,
  raw_notes_used TEXT,
  topic_summary TEXT,
  versions TEXT,                   -- JSON array of 3 version objects
  selected_version INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',     -- 'draft' | 'approved' | 'published'
  created_at TEXT,
  published_at TEXT
);
```

---

## 3. Post Pillars & Core Focus Configuration

### 1. Value
- **Core Focus**: Educate the audience on one specific concept, tool, or technique drawn from your own work or study. Always name the actual tool, framework, or technology by its real name (e.g., LangChain, FastAPI, Mem0). "Project-agnostic" means don't attach your personal project or say "I built this," NOT that you should avoid naming the specific tool/technology itself.
- **DOs**: Focus on a single concept per post (prioritize depth over breadth), Open with an analogy or visual that turns abstract ideas concrete, Attach a real-world use case to every sub-point, Use a structured scannable format, Write for a mixed audience, Name specific tools/libraries directly.
- **DON'Ts**: Never mention your name/project or "I built this", Never give bare definitions without context, Never use heavy jargon without explaining it, Never turn this into a personal narrative.

### 2. Lead Magnet
- **Core Focus**: Drive a specific engagement action (comment, DM, save) by offering a high-value resource — checklist, template, framework, or guide. Every word should funnel toward the CTA.
- **DOs**: Strictly follow a list, checklist, or table format, Make an explicit promise in title/hook, Design structured visuals (infographics/checklists), End with a clear save/CTA, Always name specific tools/libraries being compared or listed.
- **DON'Ts**: Never write in dense paragraph form, Never make it generic, Never overload the list (cap at 5–7 items), Never bury the value inside dense text.

### 3. Authority
- **Core Focus**: Position yourself as a domain expert by referencing established thought leaders, research, or institutions (Anthropic, OpenAI, Karpathy, LangChain team) — adding your own synthesis, critique, or application on top. Borrow adjacent audience attention and credibility while establishing original thoughts worth following.
- **DOs**: Reference credible sources or established experts, Show your own synthesis or angle, Demonstrate domain expertise, Connect the reference to your own work or experience.
- **DON'Ts**: Just summarize without adding your own insight, Over-rely on name-dropping, Be sycophantic toward authority, Miss the bridge to your audience's context.
- **Visual Suggestions (Mandatory Format for Industry Commentary)**: Must include the exact source URL of the referenced post, tweet, article, or research paper:
  `[Visual type + description] — Source: [exact URL of the original post/tweet/article/headline]`
  *Example*: `"Screenshot of the LinkedIn post being referenced — Source: https://www.linkedin.com/posts/example-123456"`

### 4. Personal
- **Core Focus**: Share your raw, authentic journey — struggles, confusion, mistakes, and realizations. It is neither teaching nor proving; it is relating. Maximize reach and relatability by triggering genuine human engagement.
- **DOs**: Share a real story or honest reflection, Be specific about the situation and what you learned, Show vulnerability or growth, Pair emotion with a lesson, Use real specific tool/technology names when referencing what you were building.
- **DON'Ts**: Never use fake humility or humblebragging, Never spiral into discouraging self-deprecation, Never fabricate a struggle, Never make it overly polished or corporate.

### 5. Showcase
- **Core Focus**: Prove your execution capabilities — the specific decisions, code, architecture, and benchmark results behind something you actually built. The reader outcome is confidence that you can execute, not just theorize. Strategic intent is portfolio-building: this is the post type recruiters and clients screenshot and remember when evaluating whether to hire or contract you.
- **DOs**: Follow a "Problem → Decision → Result" structure, Include specific concrete outcomes (latency reduced, accuracy improved, bug resolved), Give project context (naming company/system) to build credibility, Use real screenshots or diagrams (actual code, real architecture, before/after comparisons).
- **DON'Ts**: Never adopt a pure bragging tone ("look what I built") without insight or lessons, Never re-explain basic concepts already covered in a Value post, Never share confidential/proprietary client info, Never fabricate or exaggerate results.
- **Visual Suggestions**: Side-by-side LangGraph / system architecture diagram, before/after code comparison, or real terminal execution log screenshot.

---

## 4. Post Anatomy Structure (Per-Post-Type Scope)

When `anatomy_scope = 'per_post_type'`, the system maps specific anatomy sequences to pillars:

### A. Personal Pillar Anatomy (6-Step Narrative Sequence)
1. **Hook** (Order 1): Open with the specific moment or turning point under 8 words (1–2 lines) as a bare fact.
2. **Context** (Order 2): Background leading up to the event — what you were doing and the repeating problem.
3. **Pivot** (Order 3): Shift in thinking or approach that followed, with a concrete result or timeframe.
4. **Lesson** (Order 4): Generalize the pivot into 2–4 bulleted principles and name target audience groups.
5. **Nudge** (Order 5): Direct encouraging push naming the cost of inaction and a clear call to action.
6. **Visual Suggestion** (Order 6): Workspace photo, raw terminal, or project milestone screenshot.

### B. Global Standard Anatomy (Value, Lead Magnet, Authority, Showcase)
1. **Hook** (Order 1): Scroll-stopping claim, question, or stat with numbers under 8 words.
2. **Rehook** (Order 2): 5-step sub-structure: Statement ➔ Challenge ➔ Reasoning ➔ Action Step ➔ Power Ending.
3. **Context** (Order 3): 1–2 sentence setup explaining why this matters now and what problem it solves.
4. **Breakdown** (Order 4): Main body of value — numbered steps, bullet points, or structured specs.
5. **CTA** (Order 5): Targeted question or resource claim (no generic commentary).

---

## 5. Gemini AI Prompting System & API Key Rotation

Model used across AI operations: `gemini-3.6-flash` (with tested backup options: `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-flash-latest`).

### Key Rotation & Retry Logic (`lib/gemini.ts`)
- Parses comma-separated keys from `GEMINI_API_KEY`.
- Runs `callWithGeminiFallback()` across 2 passes. On any error (429, 503, network timeout), it logs warnings and immediately rotates to Key #2, Key #3, etc.

### Full Post Generation Prompt (`/api/generate-post`)
- Accepts Mode A (Notes) or Mode B (Web Search Results).
- Injects Active Pillar DOs/DON'Ts/Core Focus.
- Loads Writing Mechanics Directives from DB.
- Filters Hook Formulas matching active pillar, sorted by least recently used (`last_used_at`), passing top 5 formulas into prompt.
- Enforces Hook Diversity: Mandatory assignment of DIFFERENT hook formulas across Version 1, Version 2, and Version 3.
- Enforces Simple Vocabulary Rule (`vocabularyLevel: 'simple'`, avoiding `DEFAULT_AVOID_WORDS`).

---

## 6. Logic Engines & Web Search Integration

### A. Client-Side Web Search Cache (`AppContext.tsx`)
- 30-minute `localStorage` cache (`ws_cache_...`) for web search results.
- If a user re-submits a topic within 30 minutes, the browser reuses cached search results, bypassing the external `/api/web-search` network call.

### B. Repeat-Topic Keyword Overlap Check (30-Day Lookback)
- Checks previous 30 days in `posts` table for posts with the same `post_type_id`.
- Tokenizes notes into words >4 chars and compares against past `topic_summary` text.
- Warns if $\ge 3$ overlapping keywords are found.

### C. Weekly Pillar Quota Engine
- Tracks weekly target count vs used count per pillar.
- Shows inline quota confirmation modal in Studio when weekly target is reached ("Weekly Goal Reached for X — Do you still want to generate an extra post?").

---

## 7. Complete API Route Map

| Endpoint | Method | Purpose | Key Inputs | Key Output |
|---|---|---|---|---|
| `/api/settings` | GET / POST | Manage global settings, bio & tone profile | Tone/Anatomy scope | Settings record |
| `/api/post-types` | GET / POST / PUT / DELETE | Manage content pillars | Name, Core Focus, DOs, DON'Ts | Post type records |
| `/api/pillar-quotas` | GET / POST | Manage weekly pillar quotas | Target counts | Rule & quota status |
| `/api/anatomy` | GET / POST / PUT | Manage post anatomy structure | Section rules & order | Anatomy array |
| `/api/hook-types` | GET / POST / PUT | Manage hook bank formulas | Name, angles, best_fit_pillars | Hook types list |
| `/api/web-search` | POST | Web search research query | `{ query }` | `{ resultsText, resultCount }` |
| `/api/generate-post` | POST | Generate 3 post versions or section | `{ rawNotes, postTypeId, postFormat, webResults }` | `{ versions, characterCount, repeatWarning }` |
| `/api/generate-calendar` | POST / PUT | Two-phase calendar generator & saver | `{ rawDump, durationDays, startDate }` | `{ entries, validationWarnings }` |
| `/api/calendar-today` | GET | Resolve today's planned calendar post | `?date=YYYY-MM-DD` | Entry record or null |
| `/api/knowledge-dumps` | GET / POST | Manage knowledge dumps for ingestion | Raw text dump | Dump record |
| `/api/knowledge-dumps/[id]/confirm` | POST | Apply extracted points to DB tables | Selected points & apply modes | `{ success: true }` |
| `/api/posts` | GET / POST / PUT | Save, filter, or update drafts | Draft status & version data | Post records |
| `/api/history` | GET | Filtered post history log | Filters | Array of past posts |

---

## 8. Directory & File Layout

```text
linkedin-content-os/
├── app/
│   ├── api/
│   │   ├── anatomy/
│   │   ├── audit-post/
│   │   ├── calendar-today/
│   │   ├── generate-calendar/
│   │   ├── generate-post/
│   │   ├── history/
│   │   ├── hook-types/
│   │   ├── ingest/
│   │   ├── knowledge-dumps/
│   │   ├── pillar-quotas/
│   │   ├── post-types/
│   │   ├── posts/
│   │   ├── settings/
│   │   ├── web-search/
│   │   └── weekly-mapping/
│   ├── calendar/          # Full multi-day content calendar view
│   ├── formatter/         # LinkedIn Formatter tool & post copy preview
│   ├── history/           # Filterable post log & status manager
│   ├── hook-types/        # Hook bank formula manager
│   ├── ingest/            # Strategy Ingestion & Knowledge Dump review
│   ├── settings/          # Post Types + Anatomy + Tone Profile + About Me
│   ├── strategy/          # Weekly Template grid + Calendar Maker
│   ├── globals.css        # Glassmorphic design tokens & CSS variables
│   ├── layout.tsx         # Global layout & AppProvider wrapper
│   └── page.tsx           # Studio — primary generation workspace
├── components/
│   ├── Modal.tsx          # Reusable modal container
│   ├── Sidebar.tsx        # Navigation bar with active states
│   ├── TagInput.tsx       # Multi-tag editor for DOs, DON'Ts, banned phrases
│   └── Toast.tsx          # Notification toast system
├── context/
│   └── AppContext.tsx     # React context for global state & web search caching
├── lib/
│   ├── db.ts              # SQLite singleton, schema init & seed logic
│   ├── gemini.ts          # Multi-key rotation & error retry engine
│   ├── ingestion.ts       # Extraction review & semantic deduplication
│   └── constants.ts       # Default avoid words & constants
├── .env.local             # GEMINI_API_KEY environment configuration
├── brain.md               # Master architecture knowledge base
├── next.config.ts         # Server external package configuration
└── package.json
```

---

## 9. Environment Requirements

File `.env.local` in project root:
```env
GEMINI_API_KEY=your_key_1,your_key_2,your_key_3
GEMINI_MODEL=gemini-3.6-flash
```

Development commands:
```bash
npm run dev     # Run Next.js local development server
npm run build   # Build production bundle & validate TypeScript types
```
