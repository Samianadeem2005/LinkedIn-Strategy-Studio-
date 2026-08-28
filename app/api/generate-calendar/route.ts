import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { callWithGeminiFallback } from '@/lib/gemini';
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

    // Query user settings for dynamic author profile / positioning
    const settingsRow = db.prepare('SELECT tone_profile FROM settings WHERE id = 1').get() as { tone_profile?: string } | undefined;
    const authorProfile = settingsRow?.tone_profile?.trim()
      ? settingsRow.tone_profile.trim()
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

    // Expand rule pool dynamically according to user target counts
    const expandedPool: { id: string; name: string }[] = [];
    activeRules.forEach(r => {
      for (let i = 0; i < r.target_count; i++) {
        expandedPool.push({ id: r.id, name: r.name });
      }
    });

    if (expandedPool.length === 0) {
      expandedPool.push({ id: activeRules[0].id, name: activeRules[0].name });
    }

    // Deterministic shuffle per start date to assign rotated days to pillar types
    const seed = startDate.split('-').reduce((acc: number, part: string) => acc + parseInt(part), 0);
    const shuffledPool = [...expandedPool].sort((a, b) => {
      const hashA = (a.id.charCodeAt(0) + seed) % 17;
      const hashB = (b.id.charCodeAt(0) + seed) % 17;
      return hashA - hashB;
    });

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const phaseASchedule = daysOfWeek.map((dayName, idx) => {
      const rule = shuffledPool[idx % shuffledPool.length];
      return { day_of_week: dayName, post_type_id: rule.id, post_type_name: rule.name };
    });

    const startDateObj = new Date(startDate);
    const isLastDay = (i: number) => i === durationDays - 1;
    const daysSchedule = Array.from({ length: durationDays }, (_, i) => {
      const d = new Date(startDateObj);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const matched = phaseASchedule.find(p => p.day_of_week === dayName) || phaseASchedule[i % phaseASchedule.length];

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
    // PHASE B: TOPIC CLUSTERING & LOGICAL FLOW ARCS
    // ─────────────────────────────────────────────────────────────
    const capstoneDayIndex = daysSchedule.find(d => d.is_capstone)?.day_index ?? durationDays;
    const activeQuotasSummary = activeRules.map(r => `"${r.name}": ${r.target_count} post(s)/week`).join(', ');

    const calendarPrompt = `Act as an expert AI Personal Brand Strategist and Developer Growth Coach.

CONTEXT ABOUT ME:
${authorProfile}

NON-NEGOTIABLE GROWTH RULES:
1. ENGLISH ONLY — All titles, topics, bridge logic, and visual suggestions must be in clear English. No Roman Urdu, Hindi, or non-English phrases anywhere.
2. Posting Frequency: Once a day, every day, including weekends. Sunday is a high-performing day — never skip it.
3. **LOCKED PHASE A POST-TYPE SCHEDULE — DO NOT CHANGE ANY TYPE, DATE, OR ORDER:**
${daysSchedule.map(d => `Day ${d.day_index} (${d.day_name}, ${d.date}): "${d.post_type_name}"${d.is_capstone ? ' [CAPSTONE — final day of batch]' : ''}`).join('\n')}
4. WEEKLY MIX PER 7-DAY BLOCK — Respect the exact target numbers configured in Strategy & Pillar Quotas (${activeQuotasSummary}).
5. Visual Requirement: Every post needs an image (code screenshot, architecture diagram, cheat-sheet graphic, comparison table, or a candid personal photo). No text-only posts.
6. Topic Pacing & Logical Flow Rule: Do NOT drag a single tool/library/topic for more than 2-3 consecutive days. But also do NOT scatter unrelated topics randomly — each new topic should logically bridge from the previous one (e.g., "X's limitation is exactly why Y exists" or "once X is solved, Y becomes the next problem").
7. Cluster tightly-related sub-topics together (e.g., AI Memory + Persistent Chat History + Mem0 are one conceptual family — don't force them into separate far-apart days if it creates repetition).

PILLAR DEFINITIONS (must never overlap):
- Value/Educational = explains a concept generically, no project/name attached, teaches "how something works."
- Lead Magnet = a ready-to-use resource (checklist, cheat sheet, comparison table, framework) — save-worthy, list-format, not narrative.
- Showcase/Authority = "Problem → Decision → Result" — real code/architecture from MY project, proof of execution.
- Personal = my raw struggle/confusion/realization — no polish, no teaching, just relatable human moment.

MY RAW TOPIC LIST FOR THIS BATCH:
${rawDump}

TASK:
Build a ${durationDays}-day content calendar using these exact rules and columns:
| Day | Type | Post (hook + topic) | Topic(s) Covered | Visual |
- "post_type_name" must match the locked pillar defined in Strategy & Pillar Quotas.
- "post_title" column should give a specific, compelling headline/angle — not just the topic name.
- "bridge_logic" column must explain in one short phrase why this topic follows logically from the previous day's topic.
- Ensure the weekly mix ratio (${activeQuotasSummary}) defined is hit for every 7-day block.
- Ensure no topic runs more than 2-3 consecutive days.
- End the batch (Day ${capstoneDayIndex}) with a capstone Showcase post if this is the final block of a topic set, tying multiple concepts into one architecture diagram.
- "visual_suggestion" column describing exactly what kind of image should accompany each post (e.g., code screenshot, flow diagram, cheat-sheet card, comparison table graphic, candid personal photo) — matched to the post type using this rule of thumb: Value → diagrams/flowcharts, Lead Magnet → checklist/cheat-sheet cards, Showcase → real code/architecture screenshots, Personal → authentic candid photos.

Generate exactly ${durationDays} entries.
Keep the output as a single clean markdown table, no extra commentary before 
or after unless I ask for strategy notes too.`;

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
                    date: { type: SchemaType.STRING },
                    day_name: { type: SchemaType.STRING },
                    post_type_id: { type: SchemaType.STRING },
                    post_type_name: { type: SchemaType.STRING },
                    post_title: { type: SchemaType.STRING },
                    topics_covered: {
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING }
                    },
                    bridge_logic: { type: SchemaType.STRING },
                    visual_suggestion: { type: SchemaType.STRING }
                  },
                  required: ['day_index', 'date', 'day_name', 'post_type_id', 'post_type_name', 'post_title', 'topics_covered', 'bridge_logic', 'visual_suggestion']
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
    const entries = (parsed.entries as {
      day_index: number; date: string; day_name: string; post_type_id: string;
      post_type_name: string; post_title: string; topics_covered: string[];
      bridge_logic: string; visual_suggestion: string;
    }[]).map((entry, i) => {
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

    const postTypeNameSet = new Set(
      activeRules.map(r => r.name.toLowerCase())
    );

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const topics = Array.isArray(entry.topics_covered) ? entry.topics_covered : [entry.topics_covered];

      for (const rawTopic of topics) {
        if (!rawTopic) continue;
        const topic = rawTopic.trim().toLowerCase();

        if (postTypeNameSet.has(topic)) continue;
        if (['personal story', 'reflection', 'personal experience'].includes(topic)) continue;

        if (closedTopics.has(topic)) {
          validationWarnings.push(
            `Day ${entry.day_index}: Topic "${rawTopic}" reappears after its cluster had already closed (First seen Day ${topicTracker[topic].firstSeen}, last closed Day ${topicTracker[topic].lastSeen}). Topics must stay in tight 2-3 day clusters without scattering.`
          );
        } else if (topicTracker[topic]) {
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

      for (const [t, data] of Object.entries(topicTracker)) {
        if (!closedTopics.has(t) && entry.day_index - data.lastSeen >= 2) {
          closedTopics.add(t);
        }
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
      INSERT INTO calendar_entries (id, plan_id, day_index, date, post_type_id, post_title, topics_covered, bridge_logic, visual_suggestion, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')
    `);
    const tx = db.transaction((items: typeof entries) => {
      for (const e of items) {
        insertEntry.run(
          uuidv4(), planId, e.day_index, e.date, e.post_type_id,
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
