import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

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
    const postTypes = db.prepare('SELECT * FROM post_types').all() as Record<string, unknown>[];
    if (postTypes.length === 0) return NextResponse.json({ error: 'No post types defined. Add post types in Settings first.' }, { status: 400 });

    const typeByName: Record<string, { id: string; name: string }> = {};
    for (const pt of postTypes) {
      typeByName[(pt.name as string).toLowerCase()] = { id: pt.id as string, name: pt.name as string };
    }
    const defaultType = postTypes[0] ? { id: postTypes[0].id as string, name: postTypes[0].name as string } : { id: '', name: 'Value' };

    // ─────────────────────────────────────────────────────────────
    // PHASE A: RESOLVE WEEKLY TYPE SCHEDULE (Independent of topics)
    // ─────────────────────────────────────────────────────────────
    const weeklyRows = db.prepare(`
      SELECT wm.day_of_week, wm.post_type_id, pt.name as post_type_name
      FROM weekly_mapping wm
      LEFT JOIN post_types pt ON wm.post_type_id = pt.id
    `).all() as { day_of_week: string; post_type_id: string | null; post_type_name: string | null }[];

    const weeklyMap: Record<string, { id: string; name: string }> = {};
    for (const r of weeklyRows) {
      if (r.post_type_id && r.post_type_name) {
        weeklyMap[r.day_of_week] = { id: r.post_type_id, name: r.post_type_name };
      }
    }

    // Default 7-day ratio mix — exact 2/2/2/1 strategy:
    //   2 Value/Educational (Mon, Thu)
    //   2 Lead Magnet (Tue, Sat)
    //   2 Showcase/Authority (Wed=Showcase, Fri=Value+Authority weekly borrow)
    //   1 Personal (Sun — NON-NEGOTIABLE, never override)
    const defaultMix: Record<string, string> = {
      'Monday':    'Value',
      'Tuesday':   'Lead Magnet',
      'Wednesday': 'Showcase',
      'Thursday':  'Value',
      'Friday':    'Authority',
      'Saturday':  'Lead Magnet',
      'Sunday':    'Personal'
    };

    // Resolve Personal post type id — needed for hard Sunday enforcement
    const personalType =
      typeByName['personal'] ||
      Object.values(typeByName).find(t => t.name.toLowerCase().includes('personal')) ||
      defaultType;

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const phaseASchedule = daysOfWeek.map(dayName => {
      // Sunday is ALWAYS Personal — hard rule, no weekly_mapping override allowed
      if (dayName === 'Sunday') {
        return { day_of_week: 'Sunday', post_type_id: personalType.id, post_type_name: personalType.name };
      }
      const custom = weeklyMap[dayName];
      // If weekly_mapping assigned Personal to a non-Sunday day, ignore it and use the default.
      // Personal is exclusively reserved for Sunday — having it on any other day breaks the 2/2/2/1 ratio.
      const isPersonalOnWeekday = custom && custom.name.toLowerCase().includes('personal');
      if (custom && !isPersonalOnWeekday) {
        return { day_of_week: dayName, post_type_id: custom.id, post_type_name: custom.name };
      }
      const fallbackName = defaultMix[dayName] || 'Value';
      const resolvedType = typeByName[fallbackName.toLowerCase()] || defaultType;
      return { day_of_week: dayName, post_type_id: resolvedType.id, post_type_name: resolvedType.name };
    });

    const startDateObj = new Date(startDate);
    const isLastDay = (i: number) => i === durationDays - 1;
    const daysSchedule = Array.from({ length: durationDays }, (_, i) => {
      const d = new Date(startDateObj);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      // Hard-enforce Sunday = Personal at schedule level
      if (dayName === 'Sunday') {
        return {
          day_index: i + 1,
          date: dateStr,
          day_name: dayName,
          post_type_id: personalType.id,
          post_type_name: personalType.name,
          is_capstone: false
        };
      }
      const matched = phaseASchedule.find(p => p.day_of_week === dayName) || phaseASchedule[0];
      return {
        day_index: i + 1,
        date: dateStr,
        day_name: dayName,
        post_type_id: matched.post_type_id,
        post_type_name: matched.post_type_name,
        is_capstone: isLastDay(i)
      };
    });

    // ─────────────────────────────────────────────────────────────
    // PHASE B: TOPIC CLUSTERING (Fitted into Phase A's pre-assigned post types)
    // ─────────────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const capstoneDayIndex = daysSchedule.find(d => d.is_capstone)?.day_index ?? -1;

    const calendarPrompt = `You are an AI Personal Brand Strategist building a LinkedIn content calendar for an AI Engineer (Software Engineering student, class of 2027) who builds in public — working with LLMs, multi-agent systems, RAG architectures, and full-stack AI apps. Their primary proof-of-work is a company chatbot built with LangGraph, RAG, Text-to-SQL, and persistent memory.

**LOCKED PHASE A POST-TYPE SCHEDULE — DO NOT CHANGE ANY TYPE, DATE, OR ORDER:**
${daysSchedule.map(d => `Day ${d.day_index} (${d.day_name}, ${d.date}): "${d.post_type_name}"${d.is_capstone ? ' [CAPSTONE — final day of batch]' : ''}`).join('\n')}

**PILLAR DEFINITIONS — THESE MUST NEVER OVERLAP:**
- Value/Educational: Explains ONE concept generically, no project name attached. Teaches "how something works." Format: diagrams, numbered steps, plain-English explanations.
- Lead Magnet: A ready-to-use resource — checklist, cheat sheet, comparison table, or framework. Save-worthy, list-format, NOT narrative. Must include a clear CTA to save/comment.
- Showcase/Authority: "Problem → Decision → Result" using REAL code or architecture from the author's own project. Proof of execution — not hypothetical.
- Personal: Raw struggle, confusion, or realization. No polish, no teaching. Just a relatable honest human moment from the author's journey.
- Authority (Value+Authority slot): Reference a major AI company or researcher (Anthropic, OpenAI, LangChain team, Andrej Karpathy, etc.) with the author's own original angle added — never just a summary or repost.

**NON-NEGOTIABLE GENERATION RULES:**
1. ENGLISH ONLY — All titles, topics, bridge logic, and visual suggestions must be in clear English. No Roman Urdu, Hindi, or non-English phrases anywhere.
2. SUNDAY IS ALWAYS PERSONAL — Sunday posts are cluster-neutral resets (candid personal moment, raw reflection). A new topic cluster may start fresh the next Monday.
3. WEEKLY MIX PER 7-DAY BLOCK: exactly 2 Lead Magnet, 2 Value/Educational, 2 Showcase/Authority (of which 1 must be the Authority/borrow slot), 1 Personal.
4. AUTHORITY BORROWING: Exactly ONE post per 7-day window must reference a major AI company or researcher with the author's own angle. Set is_authority_borrow=true for that entry.
5. TOPIC CLUSTER ARCS (2-3 Consecutive Days):
   - Group the raw content dump IN ORDER into tight 2-3 consecutive day clusters.
   - Each cluster covers ONE specific topic (tool, framework, technique — e.g. "LangChain", "LangGraph", "Text-to-SQL").
   - A cluster MUST FULLY CLOSE before the next one begins. Once closed, a topic MUST NOT reappear later.
   - Exception: the final day of a cluster may list EXACTLY TWO items as a combination/showcase (e.g. ["LangChain","LangGraph"]). Never more than 2.
   - Tightly-related sub-topics (e.g. AI Memory + Persistent Chat History + Mem0) may share one cluster — do NOT force them into separate far-apart days.
6. LOGICAL BRIDGING: Each post must bridge from the previous day. Bridge logic should be one short phrase explaining WHY this topic follows (e.g. "X's limitation is exactly why Y exists", "once X is solved, Y becomes the next problem").
7. FIT CONTENT TO PRE-ASSIGNED POST TYPE: The title and visual must match the locked post type for that date.
8. VISUALS — match visual type to post type using this rule:
   - Value/Educational → flowchart, architecture diagram, or annotated code snippet
   - Lead Magnet → checklist card, cheat-sheet graphic, or comparison table image
   - Showcase/Authority → real code screenshot or full architecture diagram from author's project
   - Personal → candid photo of author's workspace, screen, or a real moment
   - Authority (borrow slot) → quote card or diagram with author's own annotation overlaid
9. CAPSTONE POST: If a day is marked [CAPSTONE], it must be a Showcase post that ties together ALL major concepts covered in the batch into one architecture diagram post. Title must reference the full system (e.g. "I built X with [Tech1 + Tech2 + Tech3]. Here's the full architecture.").

**RAW CONTENT DUMP (walk through in order, extract and cluster topics):**
${rawDump}

**OUTPUT FORMAT** — respond with ONLY valid JSON, no markdown fences:
{
  "entries": [
    {
      "day_index": 1,
      "date": "YYYY-MM-DD",
      "day_name": "Monday",
      "post_type_id": "<must match locked id from Phase A schedule>",
      "post_type_name": "<must match locked name from Phase A schedule>",
      "post_title": "Specific, compelling English headline — not just the topic name",
      "topics_covered": ["SpecificToolOrTechnique"],
      "bridge_logic": "One short phrase explaining why this follows logically from yesterday",
      "visual_suggestion": "Specific visual type and what it should show — matched to post type",
      "is_authority_borrow": false
    }
  ],
  "validation": {
    "warnings": []
  }
}

Generate exactly ${durationDays} entries. Capstone day is Day ${capstoneDayIndex === -1 ? durationDays : capstoneDayIndex}.`;

    const result = await model.generateContent(calendarPrompt);
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    const validationWarnings: string[] = [...(parsed.validation?.warnings ?? [])];
    const entries = (parsed.entries as {
      day_index: number; date: string; day_name: string; post_type_id: string;
      post_type_name: string; post_title: string; topics_covered: string[];
      bridge_logic: string; visual_suggestion: string; is_authority_borrow: boolean;
    }[]).map((entry, i) => {
      // Guarantee Phase A locked type integrity
      const locked = daysSchedule[i] || daysSchedule[0];
      return {
        ...entry,
        day_index: locked.day_index,
        date: locked.date,
        day_name: locked.day_name,
        post_type_id: locked.post_type_id,
        post_type_name: locked.post_type_name
      };
    });

    // ─────────────────────────────────────────────────────────────
    // PHASE C: VALIDATOR PASS — Topic Closure & Reappearance Check
    // ─────────────────────────────────────────────────────────────
    const topicTracker: Record<string, { firstSeen: number; lastSeen: number }> = {};
    const closedTopics = new Set<string>();

    // Post-type names must never be treated as content topics.
    // The LLM sometimes outputs topics_covered: ["Personal"] for Personal days — skip these.
    const postTypeNameSet = new Set(
      postTypes.map(pt => (pt.name as string).toLowerCase())
    );

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const topics = Array.isArray(entry.topics_covered) ? entry.topics_covered : [entry.topics_covered];

      // Skip topic tracking entirely for Personal days — they are cluster-neutral resets
      if (entry.post_type_name.toLowerCase().includes('personal')) continue;

      for (const rawTopic of topics) {
        if (!rawTopic) continue;
        const topic = rawTopic.trim().toLowerCase();

        // Skip strings that are post-type names, not content topics
        if (postTypeNameSet.has(topic)) continue;
        // Also skip common non-topic catch-alls
        if (['personal story', 'reflection', 'personal experience'].includes(topic)) continue;

        // Check if this topic was previously closed
        if (closedTopics.has(topic)) {
          validationWarnings.push(
            `Day ${entry.day_index}: Topic "${rawTopic}" reappears after its cluster had already closed (First seen Day ${topicTracker[topic].firstSeen}, last closed Day ${topicTracker[topic].lastSeen}). Topics must stay in tight 2-3 day clusters without scattering.`
          );
        } else if (topicTracker[topic]) {
          // Check if gap is greater than 2 days
          const gap = entry.day_index - topicTracker[topic].lastSeen;
          if (gap > 2) {
            closedTopics.add(topic);
            validationWarnings.push(
              `Day ${entry.day_index}: Topic "${rawTopic}" resurfaces after a ${gap}-day gap. Topics must resolve in clean consecutive clusters.`
            );
          } else {
            topicTracker[topic].lastSeen = entry.day_index;
          }
        } else {
          topicTracker[topic] = { firstSeen: entry.day_index, lastSeen: entry.day_index };
        }
      }

      // Check if previous topics should be closed because current day has a completely different topic
      for (const [t, data] of Object.entries(topicTracker)) {
        if (!closedTopics.has(t) && entry.day_index - data.lastSeen >= 2) {
          closedTopics.add(t);
        }
      }
    }

    // Check rolling 7-day windows for authority borrow + Sunday=Personal + mix ratio
    for (let windowStart = 0; windowStart < entries.length; windowStart += 7) {
      const window = entries.slice(windowStart, windowStart + 7);
      if (window.length < 7) break;
      const wStart = windowStart + 1;
      const wEnd = windowStart + 7;

      // Authority borrow: exactly 1 per 7-day window
      const authorityCount = window.filter(e => e.is_authority_borrow).length;
      if (authorityCount === 0) {
        validationWarnings.push(`Days ${wStart}-${wEnd}: No authority-borrow post found. Exactly 1 required per 7-day window.`);
      } else if (authorityCount > 1) {
        validationWarnings.push(`Days ${wStart}-${wEnd}: ${authorityCount} authority-borrow posts found — only 1 allowed per 7-day window.`);
      }

      // Sunday = Personal check
      for (const e of window) {
        if (e.day_name === 'Sunday' && !e.post_type_name.toLowerCase().includes('personal')) {
          validationWarnings.push(`Day ${e.day_index} (Sunday): Post type is "${e.post_type_name}" — Sunday must always be Personal.`);
        }
      }

      // Weekly mix ratio check: 2 Lead Magnet, 2 Value, 2 Showcase/Authority, 1 Personal
      const typeCounts: Record<string, number> = {};
      for (const e of window) {
        const t = e.post_type_name.toLowerCase();
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }
      const personalCount = Object.entries(typeCounts).filter(([k]) => k.includes('personal')).reduce((s, [, v]) => s + v, 0);
      if (personalCount !== 1) {
        validationWarnings.push(`Days ${wStart}-${wEnd}: Found ${personalCount} Personal post(s) — exactly 1 required per 7-day window.`);
      }
    }

    return NextResponse.json({ entries, phaseASchedule, validationWarnings });
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
      INSERT INTO calendar_entries (id, plan_id, day_index, date, post_type_id, post_title, topics_covered, bridge_logic, visual_suggestion, is_authority_borrow, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')
    `);
    const tx = db.transaction((items: typeof entries) => {
      for (const e of items) {
        insertEntry.run(
          uuidv4(), planId, e.day_index, e.date, e.post_type_id,
          e.post_title, JSON.stringify(e.topics_covered ?? []),
          e.bridge_logic ?? '', e.visual_suggestion ?? '', e.is_authority_borrow ? 1 : 0
        );
      }
    });
    tx(entries);
    return NextResponse.json({ planId, saved: entries.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
