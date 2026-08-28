import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { callWithGeminiFallback } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

function getValidPostTypeId(db: ReturnType<typeof getDb>, rawIdOrName?: string, typeName?: string): string {
  const postTypes = db.prepare('SELECT id, name FROM post_types').all() as { id: string; name: string }[];
  if (postTypes.length === 0) return 'value';

  const defaultId = postTypes[0].id;
  const lowerMap: Record<string, string> = {};

  postTypes.forEach(pt => {
    lowerMap[pt.id] = pt.id; // exact ID match
    lowerMap[pt.name.toLowerCase()] = pt.id; // exact name match
  });

  if (rawIdOrName && lowerMap[rawIdOrName]) return lowerMap[rawIdOrName];
  if (rawIdOrName && lowerMap[rawIdOrName.toLowerCase()]) return lowerMap[rawIdOrName.toLowerCase()];
  if (typeName && lowerMap[typeName.toLowerCase()]) return lowerMap[typeName.toLowerCase()];

  const searchStr = `${rawIdOrName ?? ''} ${typeName ?? ''}`.toLowerCase();

  if (searchStr.includes('value')) {
    const match = postTypes.find(p => p.name.toLowerCase().includes('value'));
    if (match) return match.id;
  }
  if (searchStr.includes('lead')) {
    const match = postTypes.find(p => p.name.toLowerCase().includes('lead'));
    if (match) return match.id;
  }
  if (searchStr.includes('showcase') || searchStr.includes('authority')) {
    const match = postTypes.find(p => p.name.toLowerCase().includes('showcase') || p.name.toLowerCase().includes('authority'));
    if (match) return match.id;
  }
  if (searchStr.includes('personal')) {
    const match = postTypes.find(p => p.name.toLowerCase().includes('personal'));
    if (match) return match.id;
  }

  if (rawIdOrName) {
    const rule = db.prepare('SELECT pillar_ids FROM custom_pillar_rules WHERE id = ?').get(rawIdOrName) as { pillar_ids?: string } | undefined;
    if (rule?.pillar_ids) {
      try {
        const ids = JSON.parse(rule.pillar_ids);
        if (Array.isArray(ids) && ids.length > 0 && lowerMap[ids[0]]) {
          return ids[0];
        }
      } catch (_) {}
    }
  }

  return defaultId;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawDump, durationDays, startDate } = body;

    if (!rawDump?.trim()) return NextResponse.json({ error: 'Raw content dump is required.' }, { status: 400 });
    if (!durationDays || durationDays < 1) return NextResponse.json({ error: 'Duration must be at least 1 day.' }, { status: 400 });
    if (!startDate) return NextResponse.json({ error: 'Start date is required.' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });

    const db = getDb();

    // Query user settings for dynamic author profile / positioning
    const settingsRow = db.prepare('SELECT about_me FROM settings WHERE id = 1').get() as { about_me?: string } | undefined;
    const authorProfile = settingsRow?.about_me?.trim()
      ? settingsRow.about_me.trim()
      : 'I am an AI Engineer (Software Engineering student, class of 2027) building in public, working with LLMs, multi-agent systems, RAG architectures, vector databases, and full-stack AI apps. I share my authentic learning and building journey on LinkedIn, using my real project (a company chatbot built with LangGraph, RAG, Text-to-SQL, and persistent memory) as my primary proof-of-work example.';

    // Fetch custom pillar rules configured dynamically from Strategy & Pillar Quotas page
    const customRules = db.prepare('SELECT * FROM custom_pillar_rules ORDER BY created_at ASC').all() as {
      id: string;
      name: string;
      pillar_ids: string;
      target_count: number;
      is_hybrid: number;
    }[];

    const postTypes = db.prepare('SELECT * FROM post_types').all() as Record<string, unknown>[];
    if (postTypes.length === 0 && customRules.length === 0) {
      return NextResponse.json({ error: 'No pillar rules defined. Add rules in Strategy page first.' }, { status: 400 });
    }

    // Build pool of active rules respecting user target counts dynamically at runtime
    const activeRules: { id: string; name: string; target_count: number; is_hybrid: boolean }[] = [];
    if (customRules.length > 0) {
      customRules.forEach(r => {
        activeRules.push({
          id: r.id,
          name: r.name,
          target_count: r.target_count > 0 ? r.target_count : 1,
          is_hybrid: Boolean(r.is_hybrid)
        });
      });
    } else {
      postTypes.forEach(pt => {
        activeRules.push({
          id: pt.id as string,
          name: pt.name as string,
          target_count: 1,
          is_hybrid: false
        });
      });
    }

    const activeQuotasSummary = activeRules.map(r => `"${r.name}": ${r.target_count} post(s)/week`).join(', ');

    // Compute date mapping for calendar entries
    const startDateObj = new Date(startDate);
    const dateMap: { date: string; day_name: string }[] = [];
    for (let i = 0; i < durationDays; i++) {
      const d = new Date(startDateObj);
      d.setDate(d.getDate() + i);
      dateMap.push({
        date: d.toISOString().split('T')[0],
        day_name: d.toLocaleDateString('en-US', { weekday: 'long' })
      });
    }

    const calendarPrompt = `Act as an expert AI Personal Brand Strategist and Developer Growth Coach.

CONTEXT ABOUT ME:
${authorProfile}

NON-NEGOTIABLE GROWTH RULES:

1. ENGLISH ONLY — All titles, topics, bridge logic, and visual suggestions must be in clear English.

2. Posting Frequency: Once a day, every day, including weekends. Sunday is a high-performing day — never skip it.

3. TOPIC EXTRACTION: Extract EVERY major distinct topic/concept from the raw material below. Every extracted topic MUST appear at least once in the final calendar.

4. TOPIC ORDER — USE AS GIVEN, DO NOT RE-DERIVE:
   If the raw material below includes an explicit ordered list of topics, treat that order as FINAL and AUTHORITATIVE. Do not re-sequence, re-rank, or second-guess it — your only job is to group it into families (Rule 5) and assign pillars/days (Rule 6) on top of it. If NO explicit order is given, then derive one logical sequence yourself using genuine prerequisite dependency (foundational concept before what builds on it), and state that derived sequence before the table.

5. CONCEPTUAL FAMILY GROUPING (based on the Rule 4 order):
   Walking through the topics in their given/derived order, group directly-adjacent topics into a "family" whenever they address the same underlying problem area (e.g., LangChain+LangGraph+Orchestrators = "how agents execute multi-step logic"; AI Memory+Persistent Chat History+Mem0 = "how agents remember things"). Topics with no close adjacent relative are standalone. Output this grouping as a labeled list before the table.

6. MANDATORY SYNTHESIS POST PER FAMILY — THIS IS THE CORE MERGE REQUIREMENT:
   Every family with 2 or more topics MUST include, as the LAST day of that family's run, ONE post that explicitly merges/synthesizes at least 2 of that family's topics together in the SAME post — showing how they connect or work together (e.g., "how LangGraph replaced my LangChain chains" or "how Persistent Chat History + Mem0 work together in my memory layer"). This synthesis post's "Topic(s) Covered" field must list 2 topics, not 1. Do not just place topics on adjacent days without ever combining any of them — adjacency alone is NOT sufficient; at least one true merge is required per family. Prefer making this synthesis post a Showcase (proof of the pieces working together in your real project), but if pillar quota doesn't allow Showcase that day, any pillar may host the synthesis as long as the 2-topic merge happens.

7. PILLAR QUOTA — assign pillars per day (chosen freely by you) subject to:
   a) Total count of each pillar across ${durationDays} days must exactly match ${activeQuotasSummary}.
   b) Each consecutive 7-day block must independently reflect the same proportional pillar mix.
   c) Final partial block (if any) should approximate the same ratio as closely as possible.
   d) The final day (Day ${durationDays}) must be a Showcase/Capstone post tying multiple concepts together.

8. Visual Requirement: Every post needs an image. No text-only posts.

9. TOPIC PACING & NO-INTERLEAVING RULE:
   a) Non-synthesis days cover exactly ONE topic.
   b) The synthesis day (Rule 6) covers exactly TWO topics from the same family.
   c) Never list three or more topics in any single day.
   d) A family must occupy an unbroken run of consecutive days — no interleaving, no leaving and returning later.
   e) No single topic run (including its family) exceeds what's needed to cover it once each plus one synthesis day — do not artificially stretch a family beyond that.
   f) Every new topic/family must logically bridge from the immediately preceding one.

10. FEASIBILITY: If topics are fewer than days allow, break broader topics into distinct sub-angles and insert them into the Rule 4 order at their correct position — not randomly.

PILLAR DEFINITIONS:
- Value/Educational = generic concept explanation, no project attached.
- Lead Magnet = checklist/cheat sheet/framework — save-worthy, list-format.
- Showcase/Authority = "Problem → Decision → Result" — real code/architecture from MY project.
- Personal = raw struggle/confusion/realization — no teaching, no polish.

MY RAW TOPIC LIST / NOTES FOR THIS BATCH:
${rawDump}

TASK:
Step 1: Output "TOPIC ORDER" (as given, or derived per Rule 4).
Step 2: Output "FAMILY GROUPING" (per Rule 5), clearly marking which day will be each family's synthesis day.
Step 3: Output the calendar table with EXACT columns:
| Day | Type | Post | Topic(s) Covered | Bridge Logic | Visual |

- "Topic(s) Covered": ONE topic normally; exactly TWO topics on each family's mandatory synthesis day (Rule 6); never three+.
- "Bridge Logic": REQUIRED every row, referencing the Rule 4/5 dependency.
- "Visual": Value → diagrams, Lead Magnet → checklist/cheat-sheet cards, Showcase → code/architecture screenshots, Personal → candid photos.

Before finalizing, verify: every family has exactly one 2-topic synthesis day, no family is split/interleaved, every extracted topic appears at least once, and pillar quota (total + per-week) is exact.

Generate exactly ${durationDays} entries.`;

    // Strictly enforce SchemaType output for zero prose, zero markdown fences, 100% structured JSON (TS equivalent of Pydantic)
    const jsonText = await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              entries: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    day_index: { type: SchemaType.NUMBER },
                    post_type_name: { type: SchemaType.STRING },
                    post_title: { type: SchemaType.STRING },
                    topics_covered: {
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING }
                    },
                    bridge_logic: { type: SchemaType.STRING },
                    visual_suggestion: { type: SchemaType.STRING }
                  },
                  required: ['day_index', 'post_type_name', 'post_title', 'topics_covered', 'bridge_logic', 'visual_suggestion']
                }
              },
              validation: {
                type: SchemaType.OBJECT,
                properties: {
                  warnings: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                  }
                }
              }
            },
            required: ['entries']
          }
        }
      });
      const result = await model.generateContent(calendarPrompt);
      return result.response.text().trim();
    });

    const parsed = JSON.parse(jsonText);
    const validationWarnings: string[] = [...(parsed.validation?.warnings ?? [])];

    // Backend soft sanity warning check if raw notes are very brief for long duration
    const wordCount = rawDump.trim().split(/\s+/).length;
    if (wordCount < 15 && durationDays >= 14) {
      validationWarnings.push("Aapke notes short hain, 30 din ke liye thoda aur detail add karein for best results.");
    }

    const entries = (parsed.entries as {
      day_index: number; post_type_name: string; post_title: string;
      topics_covered: string[]; bridge_logic: string; visual_suggestion: string;
    }[]).map((entry, i) => {
      const idx = typeof entry.day_index === 'number' ? entry.day_index - 1 : i;
      const dateInfo = dateMap[idx] || dateMap[i % dateMap.length];
      const matchedTypeId = getValidPostTypeId(db, undefined, entry.post_type_name);

      return {
        day_index: idx + 1,
        date: dateInfo.date,
        day_name: dateInfo.day_name,
        post_type_id: matchedTypeId,
        post_type_name: entry.post_type_name,
        post_title: entry.post_title,
        topics_covered: entry.topics_covered,
        bridge_logic: entry.bridge_logic,
        visual_suggestion: entry.visual_suggestion
      };
    });

    return NextResponse.json({ entries, validationWarnings });
  } catch (e) {
    console.error('generate-calendar error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Save calendar entries to DB
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, durationDays, rawDump, entries } = body;
    const db = getDb();
    const planId = uuidv4();
    db.prepare('INSERT INTO calendar_plans (id, created_at, start_date, duration_days, source_raw_dump) VALUES (?, ?, ?, ?, ?)').run(
      planId, new Date().toISOString(), startDate, durationDays, rawDump
    );
    const insertEntry = db.prepare(`
      INSERT INTO calendar_entries (id, plan_id, day_index, date, post_type_id, post_title, topics_covered, bridge_logic, visual_suggestion, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')
    `);
    const tx = db.transaction((items: typeof entries) => {
      for (const e of items) {
        const validPostTypeId = getValidPostTypeId(db, e.post_type_id, e.post_type_name);
        insertEntry.run(
          uuidv4(), planId, e.day_index, e.date, validPostTypeId,
          e.post_title, JSON.stringify(e.topics_covered ?? []),
          e.bridge_logic ?? '', e.visual_suggestion ?? ''
        );
      }
    });
    tx(entries);
    return NextResponse.json({ planId, saved: entries.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
