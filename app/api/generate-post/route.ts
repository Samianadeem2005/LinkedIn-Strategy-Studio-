import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // If regenerating a single section
    if (sectionId) {
      const section = anatomySections.find(s => s.id === sectionId);
      if (!section) return NextResponse.json({ error: 'Section not found.' }, { status: 404 });
      const sectionContent = await generateSingleSection(rawNotes, postType, tone, section, dos, donts);
      return NextResponse.json({ sectionContent, repeatWarning });
    }

    // Build the prompt for 3 versions
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in .env.local.' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const anatomyPrompt = anatomySections.map((s, i) =>
      `${i + 1}. **${s.section_name}**: ${s.rule_description}`
    ).join('\n');

    const prompt = `You are an expert LinkedIn content strategist. Generate 3 distinct, high-quality versions of a LinkedIn post.

**POST TYPE: ${postType.name}**

**CORE FOCUS — the fundamental purpose of this post type (internalize this before writing):**
${coreFocus || "No core focus defined — rely on DOs/DON'Ts as your primary guide."}

DOs:
${dos.map((d: string) => `- ${d}`).join('\n')}
DON'Ts:
${donts.map((d: string) => `- ✗ ${d}`).join('\n')}

**TONE & VOICE**
- Formality: ${tone.formality}
- Sentence length: ${tone.sentenceLength}
- Language mix: ${tone.languageMix || 'Professional English'}
- NEVER use these phrases: ${tone.bannedPhrases.length ? tone.bannedPhrases.join(', ') : 'none specified'}

**POST ANATOMY (follow this structure for EVERY version)**
${anatomyPrompt}

**RAW NOTES / TODAY'S CONTENT**
${rawNotes}

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
        "${anatomySections.map(s => s.section_name).join('": "...",\n        "')}: "..."
      },
      "visualSuggestion": "Specific, concrete visual recommendation for this post"
    },
    { "version": 2, "sections": { ... }, "visualSuggestion": "..." },
    { "version": 3, "sections": { ... }, "visualSuggestion": "..." }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    // Auto-extract topic summary from raw notes (first 200 chars of distilled keywords)
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
  donts: string[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = `You are an expert LinkedIn content strategist. Rewrite ONLY the "${section.section_name}" section of a LinkedIn post.

**Section Rule:** ${section.rule_description}

**Post Type:** ${postType.name}
**Core Focus:** ${(postType.core_focus as string | null) || "See DOs/DON'Ts below"}
DOs: ${dos.join(', ')}
DON'Ts: ${donts.join(', ')}

**Tone:** ${tone.formality}, ${tone.sentenceLength} sentences, ${tone.languageMix || 'English'}
Do NOT use: ${tone.bannedPhrases.join(', ') || 'none'}

**Original raw notes:**
${rawNotes}

Respond with ONLY the section content text. No labels, no quotes, no extra formatting.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
