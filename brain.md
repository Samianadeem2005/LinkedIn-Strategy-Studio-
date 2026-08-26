# LinkedIn Content OS — Master Architecture & Implementation Knowledge Base (`brain.md`)

This document serves as the complete, self-contained technical blueprint, schema documentation, prompt specification, and operational guide for **LinkedIn Content OS**. It contains all architectural context, database schemas, validation rules, AI prompt structures, API contracts, and workflow logic required to understand, maintain, or rebuild this system.

---

## 1. System Philosophy & Core Architectural Rules

1. **Automation Boundary**: AI operates as a high-velocity drafting co-pilot. Human oversight is mandatory before publishing. The app structures raw inputs into structured LinkedIn posts, but never auto-publishes without human approval.
2. **Server-Side Security**: All AI generation logic and API keys (`GEMINI_API_KEY`) reside strictly on the server (`/app/api/...`). The client browser never sees the API key.
3. **Data-Driven Rules Engine**: Content structures, post types, DOs/DON'Ts, Core Focus statements, post anatomy sections, and tone profiles are stored entirely in a local SQLite database (`linkedin_content.db`) rather than hardcoded in React components or prompts.
4. **Dual Validation Gates**: Business rules (e.g., mandatory DOs, DON'Ts, and Core Focus for post types) are enforced on both the client (UI disabled states and inline errors) and the server (HTTP 400 rejection).
5. **Resolution Order Enforcement**: Daily post strategy follows a deterministic 3-tier fallback hierarchy:
   - **Tier 1 (Calendar Plan)**: Date-specific planned entry from Calendar Maker.
   - **Tier 2 (Weekly Schedule)**: Fallback template mapped by day of the week (e.g., Monday = Value).
   - **Tier 3 (Manual Selection)**: Direct manual dropdown override in the Studio.

---

## 2. Complete Database Schema (`better-sqlite3`)

The application utilizes a local SQLite database located at `./linkedin_content.db`. Native module handling in Next.js is configured via `serverExternalPackages: ['better-sqlite3']` in `next.config.ts`.

```sql
-- 1. App-wide Settings & Tone Profile
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  frequency TEXT DEFAULT 'daily',
  tone_profile TEXT, -- JSON: { formality, sentenceLength, bannedPhrases, languageMix }
  anatomy_scope TEXT DEFAULT 'global' -- 'global' | 'per_post_type'
);

-- 2. Post Types / Content Pillars
CREATE TABLE IF NOT EXISTS post_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dos TEXT NOT NULL,       -- JSON array of strings
  donts TEXT NOT NULL,     -- JSON array of strings
  core_focus TEXT NOT NULL -- Detailed description of fundamental purpose and intent
);

-- 3. Post Anatomy Sections
CREATE TABLE IF NOT EXISTS post_anatomy (
  id TEXT PRIMARY KEY,
  section_name TEXT NOT NULL,
  rule_description TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  applies_to_post_type_id TEXT REFERENCES post_types(id) -- NULL = global
);

-- 4. Recurring Weekly Schedule
CREATE TABLE IF NOT EXISTS weekly_mapping (
  day_of_week TEXT PRIMARY KEY, -- 'Monday', 'Tuesday', ...
  post_type_id TEXT REFERENCES post_types(id),
  series_length INTEGER DEFAULT 1,
  is_continuation_of TEXT
);

-- 5. Multi-Day Calendar Plans
CREATE TABLE IF NOT EXISTS calendar_plans (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  start_date TEXT,
  duration_days INTEGER,
  source_raw_dump TEXT
);

-- 6. Individual Calendar Entries
CREATE TABLE IF NOT EXISTS calendar_entries (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES calendar_plans(id),
  day_index INTEGER,
  date TEXT,
  post_type_id TEXT REFERENCES post_types(id),
  post_title TEXT,
  topics_covered TEXT, -- JSON array of strings
  bridge_logic TEXT,
  is_authority_borrow INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned'
);

-- 7. Generated & Saved Posts History
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  calendar_entry_id TEXT REFERENCES calendar_entries(id),
  date TEXT,
  post_type_id TEXT REFERENCES post_types(id),
  series_part TEXT,
  raw_notes_used TEXT,
  topic_summary TEXT,
  versions TEXT, -- JSON array of 3 version objects
  selected_version INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- 'draft' | 'approved' | 'published'
  created_at TEXT,
  published_at TEXT
);
```

---

## 3. Post Pillars & Seed Configuration

Default seed data automatically injected into `linkedin_content.db` on first boot:

### 1. Value
- **Core Focus**: Educate the audience on one specific concept, tool, or technique drawn from your own work or study. The reader should finish knowing something actionable they did not know before. This is pure knowledge transfer — no selling, no storytelling detour.
- **DOs**: Teach one concrete concept clearly, Use numbered lists or steps, End with a takeaway or principle, Include a real example.
- **DON'Ts**: Be vague or generic, Skip the practical application, Use corporate jargon, Make it longer than necessary.

### 2. Lead Magnet
- **Core Focus**: Drive a specific engagement action (comment, DM, save) by offering a high-value resource — checklist, template, framework, or guide. The post exists to deliver leads and grow your list. Every word should funnel toward the CTA.
- **DOs**: Offer a specific resource/checklist/framework, Tease the value clearly in the hook, Ask for engagement to receive it, Make the offer feel exclusive and time-relevant.
- **DON'Ts**: Be salesy or pushy, Hide what the resource actually is, Offer something too generic, Forget to include a clear CTA.

### 3. Authority
- **Core Focus**: Position yourself as a domain expert by referencing established thought leaders, research, or institutions — and adding your own synthesis, critique, or application on top. The goal is borrowed credibility amplified by your unique perspective. Name-dropping alone is not enough; your insight is the point.
- **DOs**: Reference credible sources or established experts, Show your own synthesis or angle on the topic, Demonstrate domain expertise, Connect the reference to your own work or experience.
- **DON'Ts**: Just summarize without adding your own insight, Over-rely on name-dropping, Be sycophantic toward the authority, Miss the bridge to your own audience's context.

### 4. Personal
- **Core Focus**: Build human connection and relatability by sharing a real story, honest reflection, or personal moment tied to your professional journey. The reader should feel like they know you better and trust you more after reading it. No generic inspiration — only specific, earned insight.
- **DOs**: Share a real story or honest reflection, Be specific about the situation and what you learned, Show vulnerability or growth, Connect the personal moment to a professional insight.
- **DON'Ts**: Be overly dramatic or attention-seeking, Share without a point or takeaway, Make it too long or self-indulgent, Avoid a real lesson or reflection.

---

## 4. Default Post Anatomy Structure

Global structure enforced across all generations (unless scoped per post type):
1. **Hook** (Order 0): First 1-2 lines that stop the scroll. Use a bold claim, question, or surprising stat. Must work standalone as a preview snippet.
2. **Context** (Order 1): Brief setup (2-3 sentences) explaining why this matters now or what problem it solves. Bridge from hook to main content.
3. **Breakdown** (Order 2): The main content body. Use numbered steps, bullet points, or mini-paragraphs. This is where the real value is delivered.
4. **CTA** (Order 3): One clear call-to-action. Ask a specific question, invite a specific response, or direct to a specific resource. Never use generic "let me know your thoughts."
5. **Visual Suggestion** (Order 4): Concrete visual recommendation: exactly what image, diagram, screenshot, or graphic to create. Be specific (e.g. "Code snippet showing X" not just "add an image").

---

## 5. Gemini AI Prompting System (`@google/generative-ai`)

Model used across all AI operations: `gemini-3.6-flash` (configurable via `GEMINI_MODEL` in `.env.local`).

### A. Full Post Generation Prompt (`/api/generate-post`)
Generates 3 distinct post versions concurrently in a single structured JSON payload.

```text
You are an expert LinkedIn content strategist. Generate 3 distinct, high-quality versions of a LinkedIn post.

**POST TYPE: {Post Type Name}**

**CORE FOCUS — the fundamental purpose of this post type (internalize this before writing):**
{Core Focus Text}

DOs:
- {DO 1}
- {DO 2} ...

DON'Ts:
- ✗ {DON'T 1}
- ✗ {DON'T 2} ...

**TONE & VOICE**
- Formality: {Formality}
- Sentence length: {Sentence Length}
- Language mix: {Language Mix}
- NEVER use these phrases: {Banned Phrases list}

**POST ANATOMY (follow this structure for EVERY version)**
1. **Hook**: {Hook Rule}
2. **Context**: {Context Rule}
3. **Breakdown**: {Breakdown Rule}
4. **CTA**: {CTA Rule}
5. **Visual Suggestion**: {Visual Rule}

**RAW NOTES / TODAY'S CONTENT**
{Raw Notes Input}

**INSTRUCTIONS**
Generate exactly 3 versions. Each version must:
- Follow the anatomy structure above, section by section
- Be genuinely distinct (different angle, opening, or framing — not just rephrased)
- Respect all DOs and avoid all DON'Ts
- Never include placeholder text or meta-commentary
- Be ready to copy-paste to LinkedIn

**OUTPUT FORMAT** — respond with ONLY valid JSON, no markdown fences:
{
  "versions": [
    {
      "version": 1,
      "sections": {
        "Hook": "...",
        "Context": "...",
        "Breakdown": "...",
        "CTA": "..."
      },
      "visualSuggestion": "..."
    },
    { "version": 2, ... },
    { "version": 3, ... }
  ]
}
```

### B. Single Section Regeneration Prompt (`/api/generate-post` with `sectionId`)
Rewrites only a specific section without changing the rest of the post.

```text
You are an expert LinkedIn content strategist. Rewrite ONLY the "{Section Name}" section of a LinkedIn post.

**Section Rule:** {Section Rule Description}

**Post Type:** {Post Type Name}
**Core Focus:** {Core Focus Text}
DOs: {DOs list}
DON'Ts: {DON'Ts list}

**Tone:** {Tone Profile}
Do NOT use: {Banned Phrases}

**Original raw notes:**
{Raw Notes}

Respond with ONLY the section content text. No labels, no quotes, no extra formatting.
```

### C. Calendar Generation Prompt & Two-Phase Algorithm (`/api/generate-calendar`)

Calendar generation uses a **Two-Phase Generation Algorithm** to guarantee exact weekly type ratios and clean 2-3 day topic clustering without topic scattering:

1. **Phase A — Locked Weekly Type Schedule**:
   - Checks `weekly_mapping` table for user's recurring weekly template.
   - If unmapped, defaults to exact 7-day mix: `Monday: Value, Tuesday: Lead Magnet, Wednesday: Authority, Thursday: Value, Friday: Authority, Saturday: Lead Magnet, Sunday: Personal`.
   - Pre-assigns locked `post_type_id` and `post_type_name` for every date in the requested plan duration.

2. **Phase B — Topic Clustering**:
   - Fits raw content dump topics into Phase A's locked pre-assigned post types.
   - Forces topics into **clean 2-3 consecutive day clusters**.
   - Requires topic clusters to **fully resolve and close** before starting the next cluster. Closed topics MUST NOT resurface later out of sequence.
   - Strictly enforces **English-only** titles, topics, and visual suggestions.
   - Generates a concrete 1-2 line `visual_suggestion` per entry.

3. **Phase C — Topic Closure Validator**:
   - Post-generation scanner checks for topics resurfacing after cluster closure or >2 day gaps, flagging validation warnings.

```text
You are an expert LinkedIn content strategist. Create a {Duration}-day LinkedIn content calendar using a TWO-PHASE TOPIC CLUSTERING approach.

LOCKED PHASE A POST-TYPE SCHEDULE (DO NOT CHANGE ANY POST TYPE OR DATE):
Day 1 (Monday, YYYY-MM-DD): Post Type = "Value" (id: ...) ...

CRITICAL TOPIC CLUSTERING & LANGUAGE RULES (STRICT ENFORCEMENT):
1. ENGLISH ONLY: Write ALL titles, topics, and visual suggestions strictly in clear, professional English. Do NOT use any Roman Urdu or non-English phrases.
2. TOPIC CLUSTER ARCS (2-3 Consecutive Days):
   - Group topics into tight 2-3 consecutive day clusters.
   - A topic cluster MUST FULLY RESOLVE & CLOSE before starting the next cluster.
   - ONCE A CLUSTER IS CLOSED, THAT TOPIC IS DONE AND MUST NEVER REAPPEAR IN ANY LATER DAY.
   - topics_covered array must contain ONLY specific tool/library/technique (e.g., ["LangChain"]). NEVER broad umbrella categories.
   - Final day of cluster MAY be a 2-item combination showcase (e.g., ["LangChain", "LangGraph"]).
3. FIT CONTENT TO PRE-ASSIGNED POST TYPE: Write title and visual suggestion to match pre-assigned post type.
4. PERSONAL DAYS ARE CLUSTER-NEUTRAL: Sundays act as weekly reset.

OUTPUT FORMAT — respond with ONLY valid JSON:
{
  "entries": [
    {
      "day_index": 1,
      "date": "YYYY-MM-DD",
      "day_name": "Monday",
      "post_type_id": "...",
      "post_type_name": "Value",
      "post_title": "...",
      "topics_covered": ["LangChain"],
      "bridge_logic": "...",
      "visual_suggestion": "1-2 line concrete graphic idea",
      "is_authority_borrow": false
    }
  ]
}
```

---

## 6. Logic Engines & Rules Engine Implementation

### A. Repeat-Topic Keyword Overlap Check (Part 7)
Fires before generation in `/api/generate-post`:
1. Looks back 30 days in `posts` table for posts with the same `post_type_id`.
2. Tokenizes current `rawNotes` into words longer than 4 characters.
3. Compares against `topic_summary` words of previous posts.
4. If $\ge 3$ overlapping keywords are found, returns a non-blocking UI warning specifying common keywords and days elapsed since last post on that topic.

### B. Calendar Rule-Based Validation Engine
Fires after Gemini returns a generated calendar:
1. **Consecutive Post Type Check**: Warns if two consecutive days share the same pillar.
2. **Authority Borrow Cap Check**: Warns if any 7-day rolling window contains $> 2$ authority-borrowing posts.
3. **Pillar Ratio Balance Check**: Warns if any pillar exceeds 40% of the total calendar duration.

---

## 7. Complete API Route Map

| Endpoint | Method | Purpose | Key Inputs | Key Output |
|---|---|---|---|---|
| `/api/settings` | GET | Retrieve global settings & tone profile | None | `{ id, frequency, tone_profile, anatomy_scope }` |
| `/api/settings` | POST | Update settings & tone profile | `{ frequency, tone_profile, anatomy_scope }` | Updated settings record |
| `/api/post-types` | GET | List all post types | None | Array of post types with parsed JSON `dos`/`donts` |
| `/api/post-types` | POST | Create a new post type | `{ name, core_focus, dos, donts }` | Created post type record (400 if missing fields) |
| `/api/post-types/[id]` | PUT | Edit post type | `{ name, core_focus, dos, donts }` | Updated post type record |
| `/api/post-types/[id]` | DELETE | Remove post type | None | `{ success: true }` (409 if assigned in schedule/calendar) |
| `/api/anatomy` | GET | List anatomy sections | None | Ordered list of anatomy sections |
| `/api/anatomy` | POST | Create anatomy section | `{ section_name, rule_description, order_index }` | Created section record |
| `/api/anatomy` | PUT | Bulk reorder anatomy | Array of `{ id, order_index }` | `{ success: true }` |
| `/api/anatomy/[id]` | PUT / DELETE | Update/Delete section | `{ section_name, rule_description }` | Updated record or success flag |
| `/api/weekly-mapping` | GET / POST | Manage 7-day fallback schedule | Array of `{ day_of_week, post_type_id, series_length }` | Saved mappings |
| `/api/generate-post` | POST | Generate post or section | `{ rawNotes, postTypeId, date, [sectionId] }` | `{ postId, versions, repeatWarning }` |
| `/api/generate-calendar` | POST | Generate content calendar | `{ rawDump, durationDays, startDate }` | `{ entries, validationWarnings }` |
| `/api/generate-calendar` | PUT | Save edited calendar plan | `{ startDate, durationDays, rawDump, entries }` | `{ saved: count }` |
| `/api/calendar-today` | GET | Resolve today's calendar plan | `?date=YYYY-MM-DD` | Entry record or null |
| `/api/posts` | GET / POST | Save / fetch posts | Query filters | Saved post array |
| `/api/posts/[id]` | PUT | Update post version/status | `{ status, selected_version, versions }` | Updated post record |
| `/api/history` | GET | Filtered post history log | `?post_type_id=&status=&limit=` | Array of past generated posts |

---

## 8. Directory & File Layout

```text
linkedin-content-os/
├── app/
│   ├── api/
│   │   ├── anatomy/
│   │   │   ├── [id]/route.ts
│   │   │   └── route.ts
│   │   ├── calendar-today/route.ts
│   │   ├── generate-calendar/route.ts
│   │   ├── generate-post/route.ts
│   │   ├── history/route.ts
│   │   ├── post-types/
│   │   │   ├── [id]/route.ts
│   │   │   └── route.ts
│   │   ├── posts/
│   │   │   ├── [id]/route.ts
│   │   │   └── route.ts
│   │   ├── settings/route.ts
│   │   └── weekly-mapping/route.ts
│   ├── history/page.tsx       # Filterable post log & status manager
│   ├── settings/page.tsx      # Post Types CRUD + Anatomy Builder + Tone Profile
│   ├── strategy/page.tsx      # Weekly Template grid + Calendar Maker & validator
│   ├── globals.css            # Dark mode design tokens & CSS variables
│   ├── layout.tsx             # Global layout & AppProvider wrapper
│   └── page.tsx               # Studio — primary generation workspace
├── components/
│   ├── Modal.tsx              # Reusable modal container
│   ├── Sidebar.tsx            # Navigation bar with active states & resolution info
│   ├── TagInput.tsx           # Multi-tag editor for DOs, DON'Ts, banned phrases
│   └── Toast.tsx              # Notification toast system
├── context/
│   └── AppContext.tsx         # React context for global state hydration
├── lib/
│   └── db.ts                  # SQLite singleton, schema init & seed logic
├── .env.local                 # GEMINI_API_KEY environment configuration
├── brain.md                   # This master knowledge file
├── next.config.ts             # Server external package configuration for better-sqlite3
└── package.json
```

---

## 9. Environment Requirements

File `.env.local` in project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

To run development server:
```bash
npm run dev
```

To build production bundle & validate TypeScript types:
```bash
npm run build
```
