import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithGeminiFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawNotes, postTypeId, date, sectionId } = body;

    if (!rawNotes?.trim()) return NextResponse.json({ error: 'Raw notes are required.' }, { status: 400 });
    if (!postTypeId) return NextResponse.json({ error: 'Post type is required.' }, { status: 400 });

    const db = getDb();

    // Load post type
    const postType = db.prepare('SELECT * FROM post_types WHERE id = ?').get(postTypeId) as Record<string, unknown> | undefined;
    if (!postType) return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });
    const dos = JSON.parse(postType.dos as string) as string[];
    const donts = JSON.parse(postType.donts as string) as string[];
    const coreFocus = (postType.core_focus as string | null) ?? '';

    // Load anatomy - respect scope
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    const scope = (settings?.anatomy_scope as string) ?? 'global';
    let anatomySections;
    if (scope === 'per_post_type') {
      anatomySections = db.prepare(
        'SELECT * FROM post_anatomy WHERE applies_to_post_type_id = ? OR applies_to_post_type_id IS NULL ORDER BY order_index'
      ).all(postTypeId) as Record<string, unknown>[];
    } else {
      anatomySections = db.prepare(
        'SELECT * FROM post_anatomy WHERE applies_to_post_type_id IS NULL ORDER BY order_index'
      ).all() as Record<string, unknown>[];
    }

    if (anatomySections.length === 0) {
      return NextResponse.json({ error: 'No anatomy sections defined. Go to Settings and add at least one section.' }, { status: 400 });
    }

    // Load tone profile
    const toneRaw = settings?.tone_profile ? JSON.parse(settings.tone_profile as string) : {};
    const tone = {
      formality: toneRaw.formality ?? 'mixed',
      sentenceLength: toneRaw.sentenceLength ?? 'short',
      bannedPhrases: (toneRaw.bannedPhrases ?? []) as string[],
      languageMix: toneRaw.languageMix ?? ''
    };

    // Repeat-topic check (Part 7) — 30-day lookback, keyword overlap
    const lookbackDate = new Date(date ?? new Date().toISOString().split('T')[0]);
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    const recentPosts = db.prepare(
      "SELECT topic_summary, date FROM posts WHERE post_type_id = ? AND date >= ? AND status != 'draft' ORDER BY date DESC LIMIT 20"
    ).all(postTypeId, lookbackDate.toISOString().split('T')[0]) as { topic_summary: string; date: string }[];

    const rawWords = rawNotes.toLowerCase().split(/\W+/).filter((w: string) => w.length > 4);
    let repeatWarning: string | null = null;
    for (const past of recentPosts) {
      if (!past.topic_summary) continue;
      const pastWords = past.topic_summary.toLowerCase().split(/\W+/).filter((w: string) => w.length > 4);
      const overlap = rawWords.filter((w: string) => pastWords.includes(w));
      if (overlap.length >= 3) {
        const daysAgo = Math.round((new Date().getTime() - new Date(past.date).getTime()) / 86400000);
        repeatWarning = `You covered a similar topic ${daysAgo} days ago — keywords in common: ${overlap.slice(0, 5).join(', ')}.`;
        break;
      }
    }

    // ── Single-section regeneration (early return) ─────────────────
    if (sectionId) {
      const section = anatomySections.find(s => s.id === sectionId);
      if (!section) return NextResponse.json({ error: 'Section not found.' }, { status: 404 });
      const sectionContent = await generateSingleSection(rawNotes, postType, tone, section, dos, donts, coreFocus);
      return NextResponse.json({ sectionContent, repeatWarning });
    }

    // ── Determine generation mode ─────────────────────────────────
    // Mode A: generate from raw notes (default, always present)
    // Mode B: research & generate via web search results (future / optional)
    const webResults: string | undefined = body.webResults;
    const mode: 'A' | 'B' = webResults?.trim() ? 'B' : 'A';

    // Build the prompt for 3 versions
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in .env.local.' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Load enabled writing mechanics directives
    const writingMechanics = db.prepare(
      'SELECT prompt_directive FROM writing_mechanics WHERE enabled = 1 ORDER BY order_index ASC'
    ).all() as { prompt_directive: string }[];

    // Handle selected hooks if provided
    const selectedHooks = (body.selectedHooks as string[] | undefined) ?? [];
    const selectedHookIds = (body.selectedHookIds as string[] | undefined) ?? [];
    if (selectedHookIds.length > 0) {
      const updateHookStmt = db.prepare('UPDATE hook_bank SET used_count = used_count + 1 WHERE id = ?');
      for (const hid of selectedHookIds) {
        updateHookStmt.run(hid);
      }
    }

    const anatomyPrompt = anatomySections.map((s, i) =>
      `${i + 1}. **${s.section_name}**: ${s.rule_description}`
    ).join('\n');

    // ── Shared context block ───────────────────────────────────────
    const sharedContext = `
ACTIVE MODE: ${mode === 'A' ? 'A — Generate from Notes' : 'B — Research & Generate via Web Search'}
TODAY'S PILLAR: ${postType.name}

PILLAR DEFINITIONS (internalize these before writing):
- Value/Educational = explains a concept generically, no specific project name attached, teaches "how something works."
- Lead Magnet = a ready-to-use resource (checklist, cheat sheet, comparison table, framework) — save-worthy, list-format, not narrative.
- Showcase/Authority = "Problem → Decision → Result" — real code/architecture from MY project, proof of execution.
- Personal = my raw struggle/confusion/realization — no polish, no teaching, just a relatable human moment.

ACTIVE PILLAR'S CORE FOCUS:
${coreFocus || "No core focus defined — rely entirely on DOs/DON'Ts below as your primary guide."}

ACTIVE PILLAR'S DOs:
${dos.map((d: string) => `✓ ${d}`).join('\n')}

ACTIVE PILLAR'S DON'Ts:
${donts.map((d: string) => `✗ ${d}`).join('\n')}

ACTIVE POST ANATOMY (output every section in this exact order for EVERY version):
${anatomyPrompt}

WRITING MECHANICS DIRECTIVES (mandatory formatting & structural constraints):
${writingMechanics.length > 0 ? writingMechanics.map(m => `• ${m.prompt_directive}`).join('\n') : '• Keep lines short and scannable. Avoid wall of text blocks.'}

${selectedHooks.length > 0 ? `SELECTED HOOK EXAMPLES FOR INSPIRATION:\n${selectedHooks.map(h => `• "${h}"`).join('\n')}` : ''}

TONE & VOICE PROFILE:
- Formality: ${tone.formality}
- Sentence length: ${tone.sentenceLength}
- Language mix: ${tone.languageMix || 'Professional English'}
- NEVER use these phrases: ${tone.bannedPhrases.length ? tone.bannedPhrases.join(', ') : 'none specified'}

LANGUAGE RULE: Write in clear English. Roman Urdu/Hindi mixing is only acceptable for Personal-pillar posts, or as very short quoted colloquial hook fragments elsewhere — never the majority of any section or title.
`.trim();

    // ── Mode-specific instruction block ───────────────────────────
    const modeInstructions = mode === 'A'
      ? `
## MODE A — Generate from Notes

RAW NOTES / TODAY'S INPUT:
${rawNotes}

### Step 1 — Intent Analysis (run this mentally before writing)

Classify the input above as one of two types:

**Detailed input** — the notes contain specific technical detail, a narrative, a real event, code, or a described problem/solution.
→ Use this content directly as the backbone of the post; your job is mainly structuring it into the active anatomy, not inventing new substance.

**Thin/keyword input** — the notes are just a topic name or a short phrase (e.g. "pgvector indexing", "LangGraph multi-agent orchestration", a couple of words with no real detail).
→ Do NOT shallow-match — do not simply drop the keyword into a generic template sentence. Instead:
  1. Ask: what would a substantive post in this pillar actually need to say about this topic?
  2. Draw on foundational knowledge of the topic (how it works, what problem it solves, common patterns) to write real substance — not vague filler.
  3. Match depth to the pillar:
     - Value → explain the core mechanism properly
     - Lead Magnet → produce an actual usable checklist/framework about this topic
     - Personal → reflect honestly on the experience of learning or using it
  4. EXCEPTION — Showcase/Authority pillar: this pillar requires real proof from the user's own project. If the input is too thin to contain real project detail, do NOT fabricate specifics. Instead, generate the post with clearly marked placeholders (e.g. [describe what broke / what you built]) and leave a note asking the user to fill in the real detail before publishing.

### Step 2 — Write the post

Using the anatomy sections above, tone profile, pillar DOs/DON'Ts, and your Step 1 analysis, write all 3 versions. Every section must reflect what the intent analysis established — never let a thin input result in generic, could-apply-to-anyone content.
`.trim()
      : `
## MODE B — Research & Generate via Web Search

TOPIC: ${rawNotes}

WEB SEARCH RESULTS (provided via Tavily):
${webResults}

### Step 1 — Read and evaluate the sources

Review all provided search results. Identify:
- 2-4 concrete, specific facts, best practices, or recent developments actually relevant to the topic and pillar (not generic background everyone already knows).
- Whether the sources agree or conflict. If they conflict, note the disagreement briefly, or default to the most recent/authoritative-looking source.
- Whether the sources are thin or off-topic. If the search results don't contain enough substance to write a grounded post, say so explicitly instead of inventing facts to compensate.

### Step 2 — Synthesize, never copy

- NEVER reproduce sentences from the source material verbatim or near-verbatim. Paraphrase every fact fully in your own words.
- Do not string together lightly-reworded source sentences — genuinely re-explain ideas as if teaching them from understanding, not summarizing text.
- Add the user's own angle: tie the researched fact back to their actual work/project where natural (e.g. "this is exactly the tradeoff I hit when building X"), since the goal is authentic building-in-public content, not a news recap.
- If a specific source is unusually important to a claim (e.g. official docs change, benchmark number), you may reference it narratively (e.g. "the official docs now recommend...") without directly quoting it.

### Step 3 — Write the post

Use the active anatomy, tone profile, and pillar DOs/DON'Ts. The substance now comes from verified, current web research — the post should read as informed and current.
`.trim();

    // ── Full assembled prompt ──────────────────────────────────────
    const prompt = `You are an expert LinkedIn content strategist writing on behalf of an AI Engineer (Software Engineering student, class of 2027) who builds LLMs, multi-agent systems, RAG architectures, vector databases, and full-stack AI apps. They share their authentic learning and building journey on LinkedIn.

${sharedContext}

---

${modeInstructions}

---

## Output Format

Return exactly 3 versions. For each version, output every section defined in the active Post Anatomy above (in order), plus a Visual suggestion.

Respond with ONLY valid JSON — no markdown fences, no commentary before or after:
{
  "versions": [
    {
      "version": 1,
      "sections": {
        "${anatomySections.map(s => s.section_name).join('": "...",\n        "')}: "..."
      },
      "visualSuggestion": "Specific, concrete one-line description of the image/graphic to pair with this version"
    },
    { "version": 2, "sections": { ... }, "visualSuggestion": "..." },
    { "version": 3, "sections": { ... }, "visualSuggestion": "..." }
  ]
}

CRITICAL RULES:
- Each version must be genuinely distinct (different angle, opening hook, or framing — not just rephrased).
- Never include placeholder text or meta-commentary unless the Showcase/Authority pillar exception applies (thin input with no real project detail).
- Every section listed in the anatomy must appear in every version.
- The post must be ready to copy-paste to LinkedIn as-is.`;

    const jsonText = await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    });

    const parsed = JSON.parse(jsonText);

    // Auto-extract topic summary from raw notes (first 200 chars)
    const topicSummary = rawNotes.slice(0, 200).replace(/\s+/g, ' ').trim();

    // Persist post to DB
    const postId = uuidv4();
    const today = date ?? new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO posts (id, date, post_type_id, raw_notes_used, topic_summary, versions, selected_version, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'draft', ?)
    `).run(postId, today, postTypeId, rawNotes, topicSummary, JSON.stringify(parsed.versions), new Date().toISOString());

    return NextResponse.json({ postId, versions: parsed.versions, repeatWarning });
  } catch (e) {
    console.error('generate-post error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function generateSingleSection(
  rawNotes: string,
  postType: Record<string, unknown>,
  tone: { formality: string; sentenceLength: string; bannedPhrases: string[]; languageMix: string },
  section: Record<string, unknown>,
  dos: string[],
  donts: string[],
  coreFocus: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert LinkedIn content strategist. Rewrite ONLY the "${section.section_name}" section of a LinkedIn post for an AI Engineer building in public.

SECTION RULE: ${section.rule_description}

PILLAR: ${postType.name}
CORE FOCUS: ${coreFocus || "Rely on DOs/DON'Ts below as your primary guide."}

DOs:
${dos.map((d: string) => `✓ ${d}`).join('\n')}

DON'Ts:
${donts.map((d: string) => `✗ ${d}`).join('\n')}

TONE: ${tone.formality} formality, ${tone.sentenceLength} sentences, ${tone.languageMix || 'Professional English'}.
NEVER use: ${tone.bannedPhrases.join(', ') || 'none'}
LANGUAGE RULE: Write in clear English. Roman Urdu/Hindi is only acceptable for Personal-pillar posts.

RAW NOTES:
${rawNotes}

INSTRUCTION: Apply intent analysis first — if the notes are detailed, use them directly. If they are thin/keyword-only, draw on foundational knowledge to write real, substantive content rather than generic filler. Showcase/Authority pillar exception: if notes are too thin to contain real project detail, use [placeholder] markers instead of fabricating specifics.

Respond with ONLY the section content text. No labels, no quotes, no extra formatting.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
