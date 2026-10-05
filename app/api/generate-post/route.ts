import { NextRequest, NextResponse } from 'next/server';
import { getDb, getComponentsForAnatomy, getEligibleAnatomiesForIntent } from '@/lib/db';
import { resolveContentIntent } from '@/lib/intentResolver';
import { validatePostGeneration } from '@/lib/validation';
import { DEFAULT_AVOID_WORDS } from '@/lib/constants';
import { callWithGeminiFallback } from '@/lib/gemini';

function safeParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });
    try {
      return JSON.parse(sanitized);
    } catch {
      console.error('Failed to parse Gemini JSON output:', rawText);
      throw new Error('Gemini response was not formatted as valid JSON. Please try generating again.');
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawNotes, postTypeId, date, sectionId, postFormat, contentIntentId, explicitIntent } = body;

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
    const visualParts: string[] = [];

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
      if (pt.visual_suggestions) {
        try {
          const parsed = JSON.parse(pt.visual_suggestions as string);
          if (Array.isArray(parsed)) visualParts.push(...parsed);
          else visualParts.push(String(pt.visual_suggestions));
        } catch {
          visualParts.push(String(pt.visual_suggestions));
        }
      }
    });

    const postType = {
      id: postTypeId,
      name: ruleName || postTypesList.map(pt => pt.name).join(' + '),
      core_focus: focusParts.join('\n\n')
    };
    const dos = Array.from(new Set(combinedDos));
    const donts = Array.from(new Set(combinedDonts));
    const coreFocus = postType.core_focus;
    const visualSuggestionsList = Array.from(new Set(visualParts));
    const visualSuggestionsGuidance = visualSuggestionsList.length > 0
      ? visualSuggestionsList.map(v => `• ${v}`).join('\n')
      : '';

    // Load settings & tone profile
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    const userAboutMe = (settings?.about_me as string)?.trim() || "I am an AI Engineer building in public on LinkedIn.";

    const toneRaw = settings?.tone_profile ? JSON.parse(settings.tone_profile as string) : {};
    const tone = {
      formality: toneRaw.formality ?? 'mixed',
      sentenceLength: toneRaw.sentenceLength ?? 'short',
      bannedPhrases: (toneRaw.bannedPhrases ?? []) as string[],
      languageMix: toneRaw.languageMix ?? '',
      vocabularyLevel: toneRaw.vocabularyLevel ?? 'simple',
      avoidWords: (toneRaw.avoidWords && Array.isArray(toneRaw.avoidWords) && toneRaw.avoidWords.length > 0 ? toneRaw.avoidWords : DEFAULT_AVOID_WORDS) as string[]
    };

    // Repeat-topic check — 30-day lookback, keyword overlap
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

    // ── Single-section legacy regeneration handler ─────────────────
    if (sectionId) {
      const section = db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(sectionId) as Record<string, unknown> | undefined;
      if (!section) return NextResponse.json({ error: 'Section not found.' }, { status: 404 });
      const sectionContent = await generateSingleSection(rawNotes, postType, tone, section, dos, donts, coreFocus);
      return NextResponse.json({ sectionContent, repeatWarning });
    }

    // ── Step 1: Content Intent Resolution (Deterministic) ─────────
    const requestedIntent = contentIntentId || explicitIntent || null;
    const resolvedIntent = resolveContentIntent(rawNotes, postTypeId, postType.name, requestedIntent);

    // ── Step 2: Resolve a configured Anatomy deterministically ────
    const eligibleAnatomies = getEligibleAnatomiesForIntent(postTypeId, resolvedIntent.intentId);
    if (eligibleAnatomies.length === 0) {
      return NextResponse.json({
        error: `No anatomies found for pillar "${postType.name}" and intent "${resolvedIntent.displayName}". Please check Settings.`
      }, { status: 400 });
    }

    const selectedAnatomy = eligibleAnatomies[0];

    // Parse Thinking Flow into clean numbered steps
    let thinkingFlowSteps: string[] = [];
    if (selectedAnatomy.thinking_flow) {
      try {
        const parsed = JSON.parse(selectedAnatomy.thinking_flow);
        thinkingFlowSteps = Array.isArray(parsed)
          ? parsed.map((step: unknown) => typeof step === 'string'
            ? step
            : `${(step as { name?: string }).name || 'Step'}: ${(step as { instruction?: string }).instruction || ''}`.trim())
          : [String(selectedAnatomy.thinking_flow)];
      } catch {
        thinkingFlowSteps = selectedAnatomy.thinking_flow.split('\n').map(s => s.trim()).filter(Boolean);
      }
    }
    if (thinkingFlowSteps.length === 0 && selectedAnatomy.purpose) {
      thinkingFlowSteps = [selectedAnatomy.purpose];
    }

    const postComponents = getComponentsForAnatomy(selectedAnatomy.id);

    // ── Step 3: Hook Pool (deterministic configured order) ───────
    const allHookTypes = db.prepare(
      'SELECT id, name, description, angles, best_fit_pillars FROM hook_types ORDER BY name ASC'
    ).all() as { id: string; name: string; description?: string; angles: string; best_fit_pillars: string }[];

    const activePillarNames = postTypesList.map(pt => pt.name as string);
    let matchingHookTypes = allHookTypes.filter(ht => {
      try {
        const pillars: string[] = JSON.parse(ht.best_fit_pillars);
        return pillars.some(p => activePillarNames.includes(p) || p === postType.name);
      } catch {
        return false;
      }
    });

    if (matchingHookTypes.length === 0) {
      matchingHookTypes = allHookTypes;
    }

    // Keep the configured deterministic order and cap the candidate pool.
    const selectedHookTypes = matchingHookTypes.slice(0, 5);

    const hookBankList = selectedHookTypes.map((ht, idx) => {
      let parsedAngles: string[] = [];
      try { parsedAngles = JSON.parse(ht.angles); } catch {}
      const angleStr = parsedAngles.join(' / ');
      return ht.description?.trim()
        ? `[Option ${idx + 1}] ${ht.name} — ${ht.description} (angles: ${angleStr})`
        : `[Option ${idx + 1}] ${ht.name} (angles: ${angleStr})`;
    }).join('\n');

    // ── Determine generation mode ─────────────────────────────────
    const webResults: string | undefined = body.webResults;
    const mode: 'A' | 'B' = webResults?.trim() ? 'B' : 'A';

    const writingMechanics = db.prepare(
      `SELECT prompt_directive, description
       FROM writing_mechanics
       WHERE enabled = 1
       ORDER BY order_index ASC`
    ).all() as { prompt_directive?: string; description?: string }[];

    // ── Dynamic Prompt Assembly ──────────────────────────────────
    const prompt = `You are an expert LinkedIn content strategist and ghostwriter writing on behalf of:
${userAboutMe}

==================================================
GENERATION MODE
==================================================
ACTIVE MODE: ${mode === 'A' ? 'Mode A — Generate directly from Notes' : 'Mode B — Research & Generate via Web Search Results'}

==================================================
ACTIVE PILLAR
==================================================
${postType.name}

==================================================
CONTENT INTENT
==================================================
INTENT: ${resolvedIntent.intentName} ("${resolvedIntent.displayName}")
INTENT PURPOSE: ${resolvedIntent.reason}
What the reader should get from this post: Clear, substantive value tailored specifically to this intent.

==================================================
POST FORMAT + CHARACTER LIMIT
==================================================
TARGET FORMAT: ${activeFormat.name}
MANDATORY LENGTH: STRICTLY between ${activeFormat.min} and ${activeFormat.max} characters (approximately ${Math.round(activeFormat.min / 6)}–${Math.round(activeFormat.max / 6)} words).

==================================================
PILLAR CORE FOCUS
==================================================
${coreFocus || "Educate and engage with authentic, grounded engineering depth."}

==================================================
PILLAR DOs
==================================================
${dos.map((d: string) => `✓ ${d}`).join('\n')}

==================================================
PILLAR DON'Ts
==================================================
${donts.map((d: string) => `✗ ${d}`).join('\n')}

==================================================
ACTIVE ANATOMY
==================================================
ANATOMY NAME: ${selectedAnatomy.name}

==================================================
ANATOMY PURPOSE
==================================================
${selectedAnatomy.purpose}

==================================================
ANATOMY THINKING FLOW (HOW THE IDEA DEVELOPS)
==================================================
${thinkingFlowSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

CRITICAL INSTRUCTION ON THINKING FLOW:
- The Thinking Flow is your MENTAL ROADMAP for how the post's reasoning progresses.
- It is NOT a set of visible section titles or headings!
- DO NOT write headings or labels like "Observation:", "Evidence:", "Why:", "Interpretation:", "Thinking Flow:", "Hook:", or "Breakdown:" anywhere in the post text.
- Write natural paragraphs that smoothly carry the reader through these ideas.

==================================================
ANATOMY WRITING STYLE
==================================================
${selectedAnatomy.writing_style || 'Paragraph-led, natural cadence, clear line breaks.'}
${selectedAnatomy.constraints ? `ADDITIONAL CONSTRAINTS: ${selectedAnatomy.constraints}` : ''}

==================================================
POST COMPONENTS (CONFIGURED COMPOSITION)
==================================================
${postComponents.length > 0
    ? postComponents.map(component => `• ${component.name} (${component.component_type}): ${component.instructions}`).join('\n')
    : 'No post components are configured for this Anatomy. Do not add component-specific structure by default.'}
Components are reusable composition guidance, not thinking-journey headings. Use only the configured components and keep them natural.

==================================================
VISUAL GUIDANCE
==================================================
${visualSuggestionsGuidance || "Recommend a concrete, specific diagram, code snippet, terminal log, or graphic."}
- FOR AUTHORITY / INDUSTRY COMMENTARY: The visualSuggestion field MUST reference a specific post, article, chart, or screenshot source if relevant.

==================================================
AVAILABLE HOOK TYPES (CANDIDATE POOL)
==================================================
${hookBankList || 'No hook types configured.'}

==================================================
HOOK SELECTION & VERSION DIVERSITY RULES
==================================================
- Generate exactly 3 distinct versions.
- ALL 3 VERSIONS MUST USE THE SAME SELECTED ANATOMY ("${selectedAnatomy.name}"), but each version MUST use a DIFFERENT entry point / hook angle:
  * Version 1: Direct educational or analytical angle (using Hook Option A from the list above)
  * Version 2: Personal observation or narrative angle (using Hook Option B from the list above)
  * Version 3: Practical example or counter-intuitive angle (using Hook Option C from the list above)
- Do NOT make the 3 versions just synonym-swapped rewrites. Give each a distinct voice, framing, and pacing while honoring the anatomy's thinking flow.

==================================================
GLOBAL WRITING PREFERENCES
==================================================
${writingMechanics.length > 0 ? writingMechanics.map(m => `• ${m.prompt_directive || m.description}`).join('\n') : '• Keep lines short and scannable. Avoid dense blocks of text.'}

==================================================
TONE & VOICE PROFILE
==================================================
- Formality: ${tone.formality}
- Sentence length: ${tone.sentenceLength}
- Language: Clear, authentic English.
- Sound like a real technical builder sharing what they actually built, observed, or learned.

==================================================
STRICT WRITING BANS (ABSOLUTELY FORBIDDEN)
==================================================
- Reversal framing (e.g. "You think X, but actually Y" or "Everyone thinks X. They are wrong.")
- A common belief followed by a dramatic theatrical correction
- Rhetorical questions (e.g. "Ever wondered why...?")
- Repeated sentence openings used to create artificial cadence
- Stacked sentence fragments
- "Most people", "Most developers", "Many engineers"
- Corporate buzzwords & LinkedIn guru clichés
- Cliche openings
- Unnecessary adverbs
- Artificial symmetry
- Dramatic cadence
- Forced summaries
- Forced CTAs (omit or keep subtle if not natural for the pillar/anatomy)
- Em dashes (—)

VOCABULARY RULE: Use plain, everyday words. Never use formal essay words:
${tone.avoidWords.length ? tone.avoidWords.join(', ') : DEFAULT_AVOID_WORDS.join(', ')}

==================================================
NATURAL-FLOW & PILLAR SPECIFIC RULES
==================================================
- Natural Flow > Mechanical Compliance.
- Do NOT force a rehook, a CTA, or a numbered list unless genuinely appropriate.
- AUTHORITY PILLAR: Must be paragraph-led, analytical, and original. Capable of analyzing startups, founders, tech decisions, or ecosystem patterns. Sound like: "I have been observing an interesting pattern. Here is the evidence. Here is what I think is happening. Here is why it matters." NOT "5 lessons I learned from X."
- PERSONAL PILLAR: Must feel like a lived experience. Moment -> thought -> event -> realization -> change.
- SHOWCASE PILLAR: Focus on Problem -> Decision -> Build -> Result -> Lesson. Focus on reasons behind decisions rather than feature dumping.
- VALUE PILLAR: Practical, deep, and actionable. Teach the real mechanism.
- LEAD MAGNET PILLAR: Resource-first. Introduce the value of the checklist/template/roadmap early.
- ANTI-FABRICATION DIRECTIVE: Do NOT invent fake metrics, fake founder quotes, or imaginary results. Stay strictly grounded in the notes and context provided.

==================================================
RAW NOTES / INPUT
==================================================
${mode === 'A' ? `RAW NOTES:
${rawNotes}` : `RESEARCH TOPIC:
${rawNotes}

WEB SEARCH / DOCUMENTATION RESULTS:
${webResults}`}

==================================================
OUTPUT JSON SCHEMA
==================================================
Respond with ONLY valid JSON — no markdown fences, no text before or after:
{
  "versions": [
    {
      "version": 1,
      "hookType": "Name of hook type used from candidate pool",
      "angle": "Brief description of this version's angle (e.g. Direct analytical angle)",
      "content": "Full flowing LinkedIn post text with natural line breaks. Natural paragraphs. No visible section headers.",
      "visualSuggestion": "Concrete description of the image/diagram to pair with this post",
      "resources": [
        "Relevant Resource Title or Official Documentation URL"
      ]
    },
    {
      "version": 2,
      "hookType": "Different hook type from candidate pool",
      "angle": "Different angle (e.g. Personal observation angle)",
      "content": "Full flowing LinkedIn post text...",
      "visualSuggestion": "...",
      "resources": [ "..." ]
    },
    {
      "version": 3,
      "hookType": "Third different hook type from candidate pool",
      "angle": "Third angle (e.g. Practical case angle)",
      "content": "Full flowing LinkedIn post text...",
      "visualSuggestion": "...",
      "resources": [ "..." ]
    }
  ]
}`;

    // ── Call Gemini AI ────────────────────────────────────────────
    const rawResponseText = await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    const parsed = safeParseJSON(rawResponseText);

    // ── Validate Post Generation ──────────────────────────────────
    const validationReport = validatePostGeneration(
      parsed,
      activeFormat,
      tone.bannedPhrases,
      tone.avoidWords
    );

    if (!validationReport.isValid || validationReport.versions.length === 0) {
      console.error('Validation errors:', validationReport.errors);
      throw new Error(`Generation failed validation: ${validationReport.errors.join('; ')}`);
    }

    // Auto-extract topic summary from raw notes (first 200 chars)
    const topicSummary = rawNotes.slice(0, 200).replace(/\s+/g, ' ').trim();
    const firstVersionCharCount = validationReport.versions[0]?.characterCount || 0;

    return NextResponse.json({
      postId: null,
      versions: validationReport.versions,
      repeatWarning,
      postFormat: format,
      characterCount: firstVersionCharCount,
      topicSummary,
      contentIntent: {
        id: resolvedIntent.intentId,
        name: resolvedIntent.intentName,
        displayName: resolvedIntent.displayName,
        confidence: resolvedIntent.confidence,
        source: resolvedIntent.source,
        reason: resolvedIntent.reason
      },
      selectedAnatomy: {
        id: selectedAnatomy.id,
        name: selectedAnatomy.name,
        purpose: selectedAnatomy.purpose,
        writingStyle: selectedAnatomy.writing_style,
        thinkingFlow: thinkingFlowSteps
      },
      validationWarnings: validationReport.warnings
    });
  } catch (e) {
    console.error('generate-post error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function generateSingleSection(
  rawNotes: string,
  postType: Record<string, unknown>,
  tone: { formality: string; sentenceLength: string; bannedPhrases: string[]; languageMix: string; avoidWords?: string[] },
  section: Record<string, unknown>,
  dos: string[],
  donts: string[],
  coreFocus: string
): Promise<string> {
  const sectionName = (section.name || section.section_name || 'Section') as string;
  const sectionRule = (section.purpose || section.rule_description || '') as string;

  const prompt = `You are an expert LinkedIn content strategist. Rewrite ONLY the "${sectionName}" thought/section of a LinkedIn post for an AI Engineer building in public.

SECTION FOCUS: ${sectionRule}

PILLAR: ${postType.name}
CORE FOCUS: ${coreFocus || "Rely on DOs/DON'Ts below as your primary guide."}

DOs:
${dos.map((d: string) => `✓ ${d}`).join('\n')}

DON'Ts:
${donts.map((d: string) => `✗ ${d}`).join('\n')}

TONE: ${tone.formality} formality, ${tone.sentenceLength} sentences, ${tone.languageMix || 'Professional English'}.
NEVER use: ${tone.bannedPhrases.join(', ') || 'none'}
VOCABULARY RULE: Use simple, everyday words. Never use formal/literary AI words like: ${(tone.avoidWords || DEFAULT_AVOID_WORDS).join(', ')}.

RAW NOTES:
${rawNotes}

Respond with ONLY the natural prose for this thought. No labels, no quotes, no headings.`;

  return await callWithGeminiFallback(async (genAI) => {
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  });
}
