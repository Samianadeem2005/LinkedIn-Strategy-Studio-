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

-- 3. Content Intents (Pillar Goal & Reader Outcome)
CREATE TABLE IF NOT EXISTS content_intents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                         -- Slug identifier (e.g. 'industry_observation', 'compare')
  display_name TEXT NOT NULL,                 -- Human-readable label
  description TEXT NOT NULL,                  -- Purpose and reader outcome definition
  post_type_id TEXT NOT NULL REFERENCES post_types(id),
  priority INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0                -- 1 if default fallback for pillar
);

-- 4. Post Anatomy (Thinking Journey & Mental Models)
CREATE TABLE IF NOT EXISTS post_anatomy (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                         -- Anatomy title (e.g. 'Industry Observation')
  purpose TEXT,                               -- Strategic thinking goal
  thinking_flow TEXT,                         -- JSON array of progression steps
  writing_style TEXT,                         -- Style guidelines (paragraph-led, density, etc.)
  constraints TEXT,                           -- Specific restrictions
  order_index INTEGER NOT NULL,
  post_type_id TEXT REFERENCES post_types(id),
  applies_to_post_type_id TEXT REFERENCES post_types(id),
  section_name TEXT,                          -- Legacy compatibility column
  rule_description TEXT                       -- Legacy compatibility column
);

-- 5. Anatomy-to-Intent Many-to-Many Mapping
CREATE TABLE IF NOT EXISTS anatomy_intents (
  anatomy_id TEXT NOT NULL REFERENCES post_anatomy(id) ON DELETE CASCADE,
  intent_id TEXT NOT NULL REFERENCES content_intents(id) ON DELETE CASCADE,
  PRIMARY KEY (anatomy_id, intent_id)
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

-- 5. Reusable Post Components
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

CREATE TABLE IF NOT EXISTS anatomy_components (
  anatomy_id TEXT NOT NULL REFERENCES post_anatomy(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES post_components(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (anatomy_id, component_id)
);

-- 6. Hook Formulas & Bank
CREATE TABLE IF NOT EXISTS hook_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  angles TEXT NOT NULL,            -- JSON array of angle formulas
  best_fit_pillars TEXT NOT NULL,  -- JSON array of pillar names
);

-- 7. Writing Mechanics Directives
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

## 4. Post Anatomy & Content Intent Architecture

### The 3-Tier Conceptual Hierarchy
1. **Pillar**: Why are we posting? (Business & audience positioning strategy: Value, Lead Magnet, Authority, Personal, Showcase).
2. **Content Intent**: What should the reader get from this specific post? (Reader outcome: e.g. `compare`, `explain_problem`, `industry_observation`, `failure_reflection`, `architecture_explanation`).
3. **Anatomy (Thinking Journey)**: How does the thought develop? (Mental model progression: e.g. `Comparison`, `Problem → Why → Fix`, `Industry Observation`, `Architecture Reveal`).

### Pipeline Execution Flow
```text
RAW NOTES / USER IDEA
        ↓
     PILLAR (Selected in Studio or from Calendar/Weekly Schedule)
        ↓
  CONTENT INTENT (Deterministically resolved from semantic notes signals; zero LLM call)
        ↓
ELIGIBLE ANATOMIES (Filtered by Pillar + Intent via anatomy_intents junction table)
        ↓
  ANATOMY (First configured anatomy matching the selected Pillar and Intent)
        ↓
    HOOK POOL (Top 5 least recently used hook formulas matching active pillar)
        ↓
 DYNAMIC PROMPT ASSEMBLY (backend combines selected context and universal writing preferences)
        ↓
      GEMINI (gemini-3.6-flash generates 3 versions with shared anatomy but distinct angles/hooks)
        ↓
    VALIDATION (JSON structure, character counts, 3 versions, tone bans, sanitizes visible section headings)
        ↓
OUTPUT & PREVIEW (Presented in Studio as unified natural text with expandable Thinking Journey blueprint)
```

### Thinking Journey Philosophy (Anti-Template Rule)
Anatomy is a mental model, **NOT** a visible section template. The generated posts must never output mechanical section labels (e.g., `Observation:`, `Evidence:`, `Why:`, `Interpretation:`, `Implication:`). Instead, the model writes fluid, paragraph-led prose that naturally walks the reader through that reasoning journey.

---

## 5. Gemini AI Prompting System & API Key Rotation

Model used across AI operations: `gemini-3.6-flash` (with tested backup options: `gemini-2.5-flash`, `gemini-2.0-flash`).

### Key Rotation & Retry Logic (`lib/gemini.ts`)
- Parses comma-separated keys from `GEMINI_API_KEY`.
- Runs `callWithGeminiFallback()` across 2 passes. On any error (429, 503, network timeout), it logs warnings and immediately rotates to Key #2, Key #3, etc.

### Full Post Generation Prompt Assembly Order (`/api/generate-post`)
The system prompt is assembled dynamically in strict conceptual order:
1. **ROLE / AUTHOR CONTEXT**: Engineering lead / builder identity and brand voice.
2. **GENERATION MODE**: Mode A (Raw Notes) vs Mode B (Web Search Synthesis).
3. **ACTIVE PILLAR**: Target pillar name.
4. **CONTENT INTENT**: Active intent name and reader outcome description.
5. **POST FORMAT & LIMITS**: Character and word count constraints.
6. **PILLAR CORE FOCUS**: Strategic purpose from DB.
7. **PILLAR DOs**: Specific pillar directives.
8. **PILLAR DON'Ts**: Specific pillar restrictions.
9. **ACTIVE ANATOMY**: Selected anatomy name.
10. **ANATOMY PURPOSE**: Thinking goal of the post.
11. **ANATOMY THINKING FLOW**: Step-by-step reasoning progression.
12. **ANATOMY WRITING STYLE**: Paragraph-led, scannable, density rules.
13. **VISUAL GUIDANCE**: Image/screenshot specifications.
14. **AVAILABLE HOOK TYPES**: Top 5 candidate pool in configured deterministic order.
15. **HOOK SELECTION & DIVERSITY RULES**: Each version must use a different hook angle.
16. **WRITING MECHANICS**: Short scannable lines, natural paragraphs, plain vocabulary.
17. **TONE & VOICE**: Casual, authentic, sharp, professional, human.
18. **STRICT WRITING BANS**: Prohibited patterns (no reversal framing, no rhetorical questions, no em dashes, no cliches).
19. **NATURAL-FLOW & PILLAR SPECIFIC RULES**: Natural flow over mechanical compliance; Anti-fabrication directive.
20. **RAW NOTES / INPUT**: User raw notes or Tavily web search results.
21. **OUTPUT JSON SCHEMA**: Valid 3-version output format.
- Injects Active Pillar DOs/DON'Ts/Core Focus.
- Loads only universal writing-quality preferences from the Writing Mechanics configuration.
- Filters Hook Types matching the active pillar in deterministic configured order, passing the top 5 formulas into the prompt.
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
| `/api/content-intents` | GET / POST | Manage content intents per pillar | `{ name, display_name, description, post_type_id }` | Array of intent records |
| `/api/content-intents/[id]` | PUT / DELETE | Update or delete content intent | Intent updates | Updated intent record |
| `/api/resolve-intent` | POST | Deterministically resolve intent & fetch eligible anatomies | `{ rawNotes, postTypeId, explicitIntentId }` | `{ intent, anatomies, selectedAnatomy }` |
| `/api/pillar-quotas` | GET / POST | Manage weekly pillar quotas | Target counts | Rule & quota status |
| `/api/anatomy` | GET / POST / PUT | Manage post anatomy thinking flows & intent mappings | Name, purpose, thinking_flow, style, intent_ids | Rich anatomy array |
| `/api/hook-types` | GET / POST / PUT | Manage hook bank formulas | Name, angles, best_fit_pillars | Hook types list |
| `/api/web-search` | POST | Web search research query | `{ query }` | `{ resultsText, resultCount }` |
| `/api/generate-post` | POST | Generate 3 post versions with deterministic Anatomy and Hook Type selection | `{ rawNotes, postTypeId, postFormat, contentIntentId }` | `{ versions, resolvedIntent, selectedAnatomy }` |
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
│   │   ├── anatomy/               # Rich anatomy CRUD & intent junction mapping
│   │   ├── audit-post/
│   │   ├── calendar-today/
│   │   ├── content-intents/       # Content intent CRUD
│   │   ├── generate-calendar/
│   │   ├── generate-post/         # Dynamic prompt assembly and deterministic selection
│   │   ├── history/
│   │   ├── hook-types/
│   │   ├── ingest/
│   │   ├── knowledge-dumps/
│   │   ├── pillar-quotas/
│   │   ├── post-types/
│   │   ├── posts/
│   │   ├── resolve-intent/        # Live intent detection & anatomy resolution endpoint
│   │   ├── settings/
│   │   ├── web-search/
│   │   └── weekly-mapping/
│   ├── calendar/          # Full multi-day content calendar view
│   ├── formatter/         # LinkedIn Formatter tool & post copy preview
│   ├── history/           # Filterable post log & status manager
│   ├── hook-types/        # Hook bank formula manager
│   ├── ingest/            # Strategy Ingestion & Knowledge Dump review
│   ├── settings/          # Post Types + Content Intents + Post Anatomy + Tone Profile + Bio
│   ├── strategy/          # Weekly Template grid + Calendar Maker
│   ├── globals.css        # Glassmorphic design tokens & CSS variables
│   ├── layout.tsx         # Global layout & AppProvider wrapper
│   └── page.tsx           # Studio — primary generation workspace (Pillar + Intent selection)
├── components/
│   ├── Modal.tsx          # Reusable modal container
│   ├── Sidebar.tsx        # Navigation bar with active states & Settings tabs
│   ├── TagInput.tsx       # Multi-tag editor for DOs, DON'Ts, banned phrases
│   └── Toast.tsx          # Notification toast system
├── context/
│   └── AppContext.tsx     # React context for global state, content intents & web search caching
├── lib/
│   ├── db.ts              # SQLite singleton, WAL mode, schema migrations & selection helpers
│   ├── initialContentData.ts # Initial seed data for 24 intents and 24 rich anatomies
│   ├── intentResolver.ts  # Deterministic semantic regex intent resolution engine
│   ├── validation.ts      # Post generation validator & visible anatomy heading stripper
│   ├── gemini.ts          # Multi-key rotation & error retry engine
│   ├── ingestion.ts       # Extraction review & semantic deduplication
│   └── constants.ts       # Default avoid words & format limits
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

---

## 10. Content Intent Taxonomy & Rich Anatomy Catalog

### Initial Content Intent Taxonomy (24 Intents across 5 Pillars)
- **Value**:
  - `teach_concept`: Explain one specific technical concept, tool, or technique actionable for engineers.
  - `explain_problem`: Diagnose a recurring technical or architectural problem and walk through the fix.
  - `compare`: Compare two technical approaches, tools, or libraries with objective trade-offs.
  - `correct_misconception`: Dispel a common industry myth or widely repeated engineering assumption.
  - `technical_analogy`: Map a complex technical architecture to a simple real-world operational analogy.
- **Lead Magnet**:
  - `checklist`: Actionable pre-launch or implementation checklist designed to save engineering time.
  - `framework`: Structured conceptual framework or mental model for decision-making.
  - `roadmap`: Step-by-step phased roadmap guiding an engineer from novice to production deployment.
  - `template`: Ready-to-use prompt, configuration, boilerplate, or architectural specification.
  - `resource_stack`: Curated high-density stack of open-source libraries, repos, or developer tools.
- **Authority**:
  - `industry_observation`: Original analysis of emerging patterns in regional or global tech ecosystems.
  - `company_analysis`: Dissect an important strategic, architectural, or business model decision made by a real company.
  - `founder_lens`: Analyze a contrarian bet, problem, or decision made by a prominent founder.
  - `trend_analysis`: Trace an emerging technological or developer tooling shift and analyze its second-order effects.
  - `contrarian_view`: Thoughtful, evidence-backed critique challenging conventional wisdom without rage-baiting.
- **Personal**:
  - `learning_reflection`: Candid reflection on an engineering habit, work philosophy, or mindset shift.
  - `turning_point`: Specific professional moment or incident that altered career perspective.
  - `failure_reflection`: Authentic post-mortem on a technical mistake, system crash, or design error.
  - `growth_story`: Progressive narrative tracing real professional evolution over a defined timeframe.
- **Showcase**:
  - `build_story`: Narrative breakdown of an actual system, tool, or feature built and shipped.
  - `architecture_explanation`: Technical deep dive into system topology, component interactions, and data flow.
  - `case_study`: Objective breakdown of a production deployment with measured before/after benchmarks.
  - `before_after`: Contrast an old clunky workflow or system with a newly engineered solution.
  - `technical_decision`: Reasoning behind choosing one technology stack, database, or library over alternatives.

### Rich Anatomy Archetypes & Thinking Flows
- **Comparison**: Introduce Approach A ➔ Introduce Approach B ➔ Highlight critical operational difference ➔ When A makes sense ➔ When B makes sense ➔ Decision takeaway.
- **Problem → Why → Fix**: Highlight concrete failure symptom ➔ Root cause mechanism under the hood ➔ Actionable reliable fix ➔ Practical code/architecture example.
- **Industry Observation**: State the observation ➔ Cite concrete evidence/examples ➔ Unpack why the pattern is happening ➔ Offer original interpretation ➔ Outline the implication for readers.
- **Turning Point**: Open with the moment as a bare fact ➔ What you initially thought ➔ What actually happened ➔ Realization that changed your perspective ➔ New approach moving forward.
- **Architecture Reveal**: Define system requirements and constraints ➔ Present overall topology ➔ Why this architecture was chosen ➔ Trade-offs accepted ➔ Measurable outcome.
- **Cheat Sheet**: Frame recurring problem ➔ 3–5 compact core rules ➔ Introduce full reference resource ➔ Direct low-friction CTA.


# LinkedIn Content System

## Pillar → Content Intent → Anatomy Map

### 1. Authority

```text
Authority
├── Industry Observation
│   ├── Industry Observation
│   └── Trend Analysis
│
├── Company Analysis
│   └── Company Breakdown
│
├── Founder Lens
│   └── Founder Lens
│
├── Trend Analysis
│   ├── Industry Observation
│   └── Trend Analysis
│
└── Contrarian View
    └── Contrarian Opinion
```

---

### 2. Lead Magnet

```text
Lead Magnet
├── Checklist
│   ├── Checklist
│   └── Decision Tree
│
├── Framework
│   └── No currently justified existing Anatomy
│
├── Roadmap
│   └── Roadmap
│
├── Template / Scaffold
│   └── Template
│
└── Resource Stack
    └── Resource Stack
```

---

### 3. Personal

```text
Personal
├── Learning Reflection
│   ├── Turning Point
│   ├── Before / After
│   └── Failure Story
│
├── Turning Point
│   ├── Turning Point
│   └── Micro Story
│
├── Failure Reflection
│   └── Failure Story
│
└── Growth Story
    ├── Turning Point
    └── Before / After
```

---

### 4. Showcase

```text
Showcase
├── Build Story
│   ├── Build Story
│   ├── Build Failure
│   └── Demo Narrative
│
├── Architecture Explanation
│   └── Architecture Reveal
│
├── Case Study
│   ├── Build Story
│   ├── Before / After
│   └── Demo Narrative
│
├── Before / After
│   └── Before / After
│
└── Technical Decision
    └── Architecture Reveal
```

---

### 5. Value

```text
Value
├── Teach Concept
│   ├── Myth → Reality → Explanation
│   ├── Problem → Why → Fix
│   └── Technical Analogy
│
├── Explain Problem & Fix
│   └── Problem → Why → Fix
│
├── Compare Approaches
│   └── Comparison
│
├── Correct Misconception
│   └── Myth → Reality → Explanation
│
└── Technical Analogy
    └── Technical Analogy
```

---

# 3-Version Generation Strategy

## Core Rule

For all 3 generated versions:

**Pillar stays the same.**
**Content Intent stays the same.**

The system should create meaningful variation primarily through **Anatomy + Hook Type + angle/framing**.

### Preferred behavior

If an Intent has multiple mapped Anatomies, use different Anatomies across the 3 versions whenever those Anatomies represent genuinely different thinking journeys.

Example:

```text
Teach Concept
├── Version 1 → Myth → Reality → Explanation
├── Version 2 → Problem → Why → Fix
└── Version 3 → Technical Analogy
```

This produces three genuinely different ways of teaching the same concept.

### If an Intent has only 2 Anatomies

Use both, then reuse one only if necessary:

```text
Checklist
├── Version 1 → Checklist
├── Version 2 → Decision Tree
└── Version 3 → Checklist
```

The repeated Anatomy must still produce a substantially different post through a different Hook Type, angle, framing, examples, or emphasis.

### If an Intent has only 1 Anatomy

Use the same Anatomy for all 3 versions:

```text
Technical Decision
└── Architecture Reveal
    ├── Version 1 → Angle A
    ├── Version 2 → Angle B
    └── Version 3 → Angle C
```

Do not invent additional Anatomies just to create variation.

## Anatomy Selection Rule

Anatomy is the **thinking journey**, not a cosmetic variation.

Therefore:

* Never use an Anatomy that is not mapped to the selected Content Intent.
* Do not force different Anatomies simply because 3 versions are required.
* Prefer different mapped Anatomies when they create genuinely different intellectual approaches.
* Keep the Content Intent fixed across all 3 versions.
* Use Hook Types and angles to create additional variation.

## Selection Without LRU

`anatomy_intents` does not have a priority/order column.

The system must NOT use:

* LRU
* `last_used_at`
* random selection
* hidden recency logic
* manual Anatomy selection in Studio

For automatic selection, use the existing Anatomy `order_index` as the deterministic ordering mechanism.

For 3-version generation:

1. Get all Anatomies mapped to the selected Content Intent.
2. Order them deterministically using Anatomy `order_index`.
3. Prefer a different mapped Anatomy for each version where enough meaningful Anatomies exist.
4. If the number of Anatomies is smaller than 3, reuse an Anatomy only when necessary.
5. Never select an unrelated Anatomy.

## Example

```text
Pillar
  ↓
Content Intent
  ↓
Mapped Anatomies
  ↓
Version 1 → Anatomy + Hook Type + Angle
Version 2 → Anatomy + Hook Type + Angle
Version 3 → Anatomy + Hook Type + Angle
```

The goal is **three meaningfully different posts**, not three superficial rewrites of the same post.

## Framework Exception

`Framework` currently has no semantically justified existing Anatomy after the mapping cleanup.

Do not assign an unrelated existing Anatomy merely to make generation work.

Until a suitable Anatomy is intentionally defined, this Intent should be handled explicitly rather than silently falling back to an unrelated Anatomy.
