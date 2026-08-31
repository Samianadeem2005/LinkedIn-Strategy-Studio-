import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithGeminiFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawNotes, postTypeId, date, sectionId, postFormat } = body;

    const format = postFormat || 'text_post';
    const formatConstraints: Record<string, { name: string; min: number; max: number }> = {
      'text_post': { name: 'Text Post', min: 600, max: 1200 },
      'image_post': { name: 'Image Post', min: 900, max: 1500 },
      'carousel': { name: 'Carousel', min: 1200, max: 1500 },
      'video_post': { name: 'Video Post', min: 500, max: 800 }
    };
    const activeFormat = formatConstraints[format] || formatConstraints['text_post'];

    if (!rawNotes?.trim()) return NextResponse.json({ error: 'Raw notes are required.' }, { status: 400 });
    if (!postTypeId) return NextResponse.json({ error: 'Post type is required.' }, { status: 400 });

    const db = getDb();

    // Check if postTypeId matches a custom_pillar_rules row
    const rule = db.prepare('SELECT * FROM custom_pillar_rules WHERE id = ?').get(postTypeId) as { id: string; name: string; pillar_ids: string } | undefined;

    let targetPillarIds: string[] = [];
    let ruleName = '';

    if (rule) {
      ruleName = rule.name;
      try { targetPillarIds = JSON.parse(rule.pillar_ids); } catch { targetPillarIds = [postTypeId]; }
    } else {
      targetPillarIds = [postTypeId];
    }

    // Load referenced post types
    const postTypesList = db.prepare(
      `SELECT * FROM post_types WHERE id IN (${targetPillarIds.map(() => '?').join(',')})`
    ).all(...targetPillarIds) as Record<string, unknown>[];

    if (postTypesList.length === 0) return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });

    const combinedDos: string[] = [];
    const combinedDonts: string[] = [];
    const focusParts: string[] = [];

    postTypesList.forEach(pt => {
      try {
        const d = JSON.parse(pt.dos as string) as string[];
        combinedDos.push(...d);
      } catch {}
      try {
        const dt = JSON.parse(pt.donts as string) as string[];
        combinedDonts.push(...dt);
      } catch {}
      if (pt.core_focus) focusParts.push(`${pt.name}: ${pt.core_focus}`);
    });

    const postType = {
      id: postTypeId,
      name: ruleName || postTypesList.map(pt => pt.name).join(' + '),
      core_focus: focusParts.join('\n\n')
    };
    const dos = Array.from(new Set(combinedDos));
    const donts = Array.from(new Set(combinedDonts));
    const coreFocus = postType.core_focus;

    // Load anatomy - respect scope
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    const scope = (settings?.anatomy_scope as string) ?? 'global';
    let anatomySections: Record<string, unknown>[] = [];
    if (scope === 'per_post_type') {
      const typeSpecific = db.prepare(
        'SELECT * FROM post_anatomy WHERE applies_to_post_type_id = ? ORDER BY order_index ASC'
      ).all(postTypeId) as Record<string, unknown>[];

      if (typeSpecific.length > 0) {
        anatomySections = typeSpecific;
      } else {
        anatomySections = db.prepare(
          'SELECT * FROM post_anatomy WHERE applies_to_post_type_id IS NULL ORDER BY order_index ASC'
        ).all() as Record<string, unknown>[];
      }
    } else {
      anatomySections = db.prepare(
        'SELECT * FROM post_anatomy WHERE applies_to_post_type_id IS NULL ORDER BY order_index ASC'
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
      'SELECT prompt_directive, description FROM writing_mechanics WHERE enabled = 1 ORDER BY order_index ASC'
    ).all() as { prompt_directive?: string; description?: string }[];

    // Load active hook types live from DB - filtered by today's pillar & prioritized by least recently used (max 5)
    const allHookTypes = db.prepare(
      'SELECT id, name, description, angles, best_fit_pillars, last_used_at FROM hook_types'
    ).all() as { id: string; name: string; description?: string; angles: string; best_fit_pillars: string; last_used_at?: string | null }[];

    const activePillarNames = postTypesList.map(pt => pt.name as string);
    let matchingHookTypes = allHookTypes.filter(ht => {
      try {
        const pillars: string[] = JSON.parse(ht.best_fit_pillars);
        return pillars.some(p => activePillarNames.includes(p) || p === postType.name);
      } catch {
        return false;
      }
    });

    // Fall back to all hook types if zero match current pillar
    if (matchingHookTypes.length === 0) {
      matchingHookTypes = allHookTypes;
    }

    // Sort by least recently used (nulls first, then oldest timestamp)
    matchingHookTypes.sort((a, b) => {
      if (!a.last_used_at && !b.last_used_at) return 0;
      if (!a.last_used_at) return -1;
      if (!b.last_used_at) return 1;
      return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime();
    });

    // Take top 5
    const selectedHookTypes = matchingHookTypes.slice(0, 5);

    // Update last_used_at for selected hook types
    if (selectedHookTypes.length > 0) {
      const nowIso = new Date().toISOString();
      const updateStmt = db.prepare('UPDATE hook_types SET last_used_at = ? WHERE id = ?');
      for (const ht of selectedHookTypes) {
        updateStmt.run(nowIso, ht.id);
      }
    }

    const hookBankList = selectedHookTypes.map(ht => {
      let parsedAngles: string[] = [];
      try { parsedAngles = JSON.parse(ht.angles); } catch {}
      const angleStr = parsedAngles.join(' / ');
      return ht.description?.trim()
        ? `${ht.name} — ${ht.description} (angles: ${angleStr})`
        : `${ht.name} (angles: ${angleStr})`;
    }).join('\n');

    const anatomyPrompt = anatomySections.map((s, i) =>
      `${i + 1}. **${s.section_name}**: ${s.rule_description}`
    ).join('\n');

    const userAboutMe = (settings?.about_me as string)?.trim() || "I am an AI Engineer building in public on LinkedIn.";

    // ── Mode-specific instruction block ───────────────────────────
    const modeInstructions = mode === 'A'
      ? `## MODE A — Generate from Notes
RAW NOTES / INPUT: ${rawNotes}
- **Detailed Input**: Use code, specs & real project details directly as backbone.
- **Thin / Keyword Input** (e.g. "RAG", "pgvector"): Break down the complete end-to-end architecture & all subcomponents (e.g. chunking → embeddings → vector indexing → similarity search → context synthesis). Never write superficial generic text.`
      : `## MODE B — Research & Generate via Web Search & Official Docs
TOPIC: ${rawNotes}
SEARCH RESULTS:
${webResults}
- **Extract Technical Specs**: Pull official framework docs, API specs, architecture patterns, subcomponents (e.g. chunking, vector indexing, retrieval pipelines, state graphs), benchmarks & best practices.
- **Synthesize**: Re-explain the full concept end-to-end in your own engineering voice with practical workflow steps & trade-offs.`;

    // ── Full assembled prompt ──────────────────────────────────────
    const prompt = `You are an expert LinkedIn content strategist writing on behalf of:
${userAboutMe}

ACTIVE MODE: ${mode === 'A' ? 'Mode A — Generate from Notes' : 'Mode B — Research & Generate via Web Search & Official Docs'}

TODAY'S PILLAR: ${postType.name}

TARGET POST FORMAT: ${activeFormat.name} (Mandatory Length: STRICTLY between ${activeFormat.min} and ${activeFormat.max} characters across all sections combined)

ACTIVE PILLAR'S CORE FOCUS:
${coreFocus || "No core focus defined — rely entirely on DOs/DON'Ts below as your primary guide."}

ACTIVE PILLAR'S DOs:
${dos.map((d: string) => `✓ ${d}`).join('\n')}

ACTIVE PILLAR'S DON'Ts:
${donts.map((d: string) => `✗ ${d}`).join('\n')}

ACTIVE POST ANATOMY (output every section in this exact order for EVERY version):
${anatomyPrompt}

WRITING MECHANICS DIRECTIVES (mandatory formatting & structural constraints):
${writingMechanics.length > 0 ? writingMechanics.map(m => `• ${m.prompt_directive || m.description}`).join('\n') : '• Keep lines short and scannable. Avoid wall of text blocks.'}

AVAILABLE HOOK TYPES (structural moves, not literal text):
${hookBankList || 'No hook types configured.'}

From the hook types above, pick ONE that best fits today's pillar and topic. 
Write an original sentence per version following one of its angles — never 
copy the angle text directly. All 3 versions use the SAME hook type, each 
with a different angle/wording.

TONE & VOICE PROFILE:
- Formality: ${tone.formality}
- Sentence length: ${tone.sentenceLength}
- Language mix: ${tone.languageMix || 'Not specified'}
- NEVER use these phrases: ${tone.bannedPhrases.length ? tone.bannedPhrases.join(', ') : 'none specified'}

---

${modeInstructions}

---

## Output Format
Return exactly 3 versions. For each version, output every section defined in the active Post Anatomy above (in order), plus a Visual suggestion and a Resources array.
Respond with ONLY valid JSON — no markdown fences, no commentary before or after:
{
  "versions": [
    {
      "version": 1,
      "sections": {
        "${anatomySections.map(s => s.section_name).join('": "...",\n        "')}: "..."
      },
      "visualSuggestion": "Specific, concrete one-line description of the image/graphic to pair with this version",
      "resources": [
        "Official Documentation / Resource Title (https://example.com/url)"
      ]
    },
    { "version": 2, "sections": { ... }, "visualSuggestion": "...", "resources": [ "..." ] },
    { "version": 3, "sections": { ... }, "visualSuggestion": "...", "resources": [ "..." ] }
  ]
}

CRITICAL RULES:
- Each version must be genuinely distinct (different angle, opening hook, or framing — not just rephrased).
- All 3 versions apply the SAME hook type but different angles/wording — never repeat the exact same hook sentence across versions.
- Never include placeholder text or meta-commentary unless the Showcase/Authority pillar exception applies (thin input with no real project detail).
- Every section listed in the anatomy must appear in every version.
- **RESOURCES ARRAY**: In every version, include 1-4 specific URLs or official doc references in the "resources" array. In Mode B (Web Search), extract the exact source URLs/titles from the provided search results. In Mode A, list official framework doc URLs, GitHub repos, or technical specs relevant to the topic (e.g. LangChain Docs (https://python.langchain.com), PostgreSQL pgvector (https://github.com/pgvector/pgvector)).
- The post must be ready to copy-paste to LinkedIn as-is.`;

    const jsonText = await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    });

    const parsed = JSON.parse(jsonText);
    const sanitizedVersions = (parsed.versions || []).map((v: Record<string, unknown>) => ({
      ...v,
      resources: Array.isArray(v.resources) ? v.resources.map((r: unknown) => String(r)) : []
    }));

    // Auto-extract topic summary from raw notes (first 200 chars)
    const topicSummary = rawNotes.slice(0, 200).replace(/\s+/g, ' ').trim();

    // Calculate total character count for first version
    const firstVersionSections = sanitizedVersions[0]?.sections || {};
    const totalCharCount = Object.values(firstVersionSections).reduce((acc: number, curr: unknown) => acc + (typeof curr === 'string' ? curr.length : 0), 0);

    // Do NOT automatically persist to posts DB — only persist when user clicks "Save to Drafts"
    return NextResponse.json({ postId: null, versions: sanitizedVersions, repeatWarning, postFormat: format, characterCount: totalCharCount, topicSummary });
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
