import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEFAULT_AVOID_WORDS } from '@/lib/constants';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithGeminiFallback } from '@/lib/gemini';

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { version, postTypeId, rawNotes, postFormat } = body;

    if (!version || !version.sections) {
      return NextResponse.json({ error: 'Post version with sections is required for audit.' }, { status: 400 });
    }
    if (!postTypeId) {
      return NextResponse.json({ error: 'postTypeId is required.' }, { status: 400 });
    }

    const format = postFormat || 'text_post';
    const formatConstraints: Record<string, { name: string; min: number; max: number }> = {
      'text_post': { name: 'Text Post', min: 600, max: 1200 },
      'image_post': { name: 'Image Post', min: 900, max: 1500 },
      'carousel': { name: 'Carousel', min: 1200, max: 1500 },
      'video_post': { name: 'Video Post', min: 500, max: 800 }
    };
    const activeFormat = formatConstraints[format] || formatConstraints['text_post'];

    const db = getDb();

    // 1. Load Pillar rules & DOs/DON'Ts
    const rule = db.prepare('SELECT * FROM custom_pillar_rules WHERE id = ?').get(postTypeId) as { id: string; name: string; pillar_ids: string } | undefined;
    let targetPillarIds: string[] = [];
    let ruleName = '';
    if (rule) {
      ruleName = rule.name;
      try { targetPillarIds = JSON.parse(rule.pillar_ids); } catch { targetPillarIds = [postTypeId]; }
    } else {
      targetPillarIds = [postTypeId];
    }

    const postTypesList = db.prepare(
      `SELECT * FROM post_types WHERE id IN (${targetPillarIds.map(() => '?').join(',')})`
    ).all(...targetPillarIds) as Record<string, unknown>[];

    if (postTypesList.length === 0) {
      return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });
    }

    const combinedDos: string[] = [];
    const combinedDonts: string[] = [];
    const focusParts: string[] = [];
    const visualParts: string[] = [];

    postTypesList.forEach(pt => {
      try { combinedDos.push(...(JSON.parse(pt.dos as string) as string[])); } catch {}
      try { combinedDonts.push(...(JSON.parse(pt.donts as string) as string[])); } catch {}
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

    const pillarName = ruleName || postTypesList.map(pt => pt.name).join(' + ');
    const dos = Array.from(new Set(combinedDos));
    const donts = Array.from(new Set(combinedDonts));
    const coreFocus = focusParts.join('\n\n');
    const visualSuggestionsList = Array.from(new Set(visualParts));
    const visualSuggestions = visualSuggestionsList.length > 0
      ? visualSuggestionsList.map(v => `• ${v}`).join('\n')
      : 'None defined.';

    // 2. Load Anatomy & Settings
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

    const toneRaw = settings?.tone_profile ? JSON.parse(settings.tone_profile as string) : {};
    const tone = {
      formality: toneRaw.formality ?? 'mixed',
      sentenceLength: toneRaw.sentenceLength ?? 'short',
      bannedPhrases: (toneRaw.bannedPhrases ?? []) as string[],
      languageMix: toneRaw.languageMix ?? '',
      vocabularyLevel: toneRaw.vocabularyLevel ?? 'simple',
      avoidWords: (toneRaw.avoidWords && Array.isArray(toneRaw.avoidWords) && toneRaw.avoidWords.length > 0 ? toneRaw.avoidWords : DEFAULT_AVOID_WORDS) as string[]
    };

    // 3. Ground Truth Numeric & String Metric Computations in JavaScript Code
    const sectionsObj = version.sections || {};
    const sectionEntries = Object.entries(sectionsObj) as [string, string][];
    const fullPostText = sectionEntries.map(([_, val]) => val).join('\n\n');

    // Calculate Hook Word Count in code
    const hookText = (sectionsObj.Hook || sectionsObj.hook || '').trim();
    const hookWordCount = hookText ? hookText.split(/\s+/).filter(Boolean).length : 0;
    const hookWordLimit = 8;
    const isHookWordCountValid = hookWordCount <= hookWordLimit;

    // Calculate Total Character Count in code
    const totalCharCount = sectionEntries.reduce((acc, [_, val]) => acc + (typeof val === 'string' ? val.length : 0), 0);
    const isCharCountValid = totalCharCount >= activeFormat.min && totalCharCount <= activeFormat.max;

    // Search Banned Phrases in code (exact & regex matching)
    const bannedPhrasesFound: string[] = [];
    tone.bannedPhrases.forEach(phrase => {
      if (phrase.trim()) {
        const regex = new RegExp(`\\b${escapeRegex(phrase.trim())}\\b`, 'i');
        if (regex.test(fullPostText)) {
          bannedPhrasesFound.push(phrase.trim());
        }
      }
    });

    // Search Forbidden AI Vocabulary Words in code per section
    const avoidWordsFound: { word: string; section: string }[] = [];
    sectionEntries.forEach(([sectionName, sectionText]) => {
      if (typeof sectionText === 'string') {
        tone.avoidWords.forEach(word => {
          const w = word.trim();
          if (w) {
            const regex = new RegExp(`\\b${escapeRegex(w)}\\b`, 'i');
            if (regex.test(sectionText)) {
              avoidWordsFound.push({ word: w, section: sectionName });
            }
          }
        });
      }
    });

    // Check missing anatomy sections in code
    const missingAnatomySections = anatomySections
      .map(s => String(s.section_name))
      .filter(sName => !sectionsObj[sName]);

    const groundTruthMetrics = {
      hookWordCount,
      hookWordLimit,
      isHookWordCountValid,
      totalCharCount,
      formatName: activeFormat.name,
      formatMin: activeFormat.min,
      formatMax: activeFormat.max,
      isCharCountValid,
      bannedPhrasesFound,
      avoidWordsFound,
      missingAnatomySections
    };

    // 4. Independent 2nd API Call — Fresh Auditor Persona Prompt
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const anatomyPrompt = anatomySections.map((s, i) => `${i + 1}. **${s.section_name}**: ${s.rule_description}`).join('\n');

    const auditPrompt = `You are an independent, strict, and skeptical compliance auditor evaluating a generated LinkedIn post.
You did NOT write this post. You must audit it critically against the exact configuration rules below.

IMPORTANT STANDING EXCEPTION:
- The "resources" array / section in the post is an INTENTIONAL, PERMANENT feature of the system. Do NOT flag "resources" as a stray, unexpected, or extra section.

GROUND TRUTH NUMERIC METRICS (COMPUTED IN CODE — DO NOT OVERRIDE THESE NUMBERS):
- Hook Word Count: ${hookWordCount} words (Instruction Limit: maximum ${hookWordLimit} words → Status: ${isHookWordCountValid ? 'PASS' : 'FAIL: Hook contains ' + hookWordCount + ' words, exceeding the ' + hookWordLimit + '-word limit'})
- Total Character Count: ${totalCharCount} characters (Target Range: ${activeFormat.min}–${activeFormat.max} chars → Status: ${isCharCountValid ? 'PASS' : 'FAIL: Character count ' + totalCharCount + ' outside range [' + activeFormat.min + ', ' + activeFormat.max + ']'})
- Banned Phrases Found in Code: ${bannedPhrasesFound.length > 0 ? bannedPhrasesFound.join(', ') : 'None'}
- Forbidden AI Vocabulary Words Found in Code: ${avoidWordsFound.length > 0 ? avoidWordsFound.map(f => `"${f.word}" in ${f.section}`).join(', ') : 'None'}
- Missing Anatomy Sections in Code: ${missingAnatomySections.length > 0 ? missingAnatomySections.join(', ') : 'None'}

RAW INPUT NOTES (Source Material):
${rawNotes || 'None provided.'}

TARGET PILLAR: ${pillarName}
CORE FOCUS:
${coreFocus || 'None defined.'}

VISUAL SUGGESTIONS GUIDANCE:
${visualSuggestions || 'None defined.'}

ACTIVE PILLAR DOs:
${dos.map(d => `✓ ${d}`).join('\n')}

ACTIVE PILLAR DON'Ts:
${donts.map(d => `✗ ${d}`).join('\n')}

ACTIVE POST ANATOMY:
${anatomyPrompt}

TONE & VOICE:
- Formality: ${tone.formality}
- Sentence Length: ${tone.sentenceLength}
- Vocabulary Level: ${tone.vocabularyLevel}
- Avoid Words (AI Tells): ${tone.avoidWords.join(', ') || 'None'}
- Banned Phrases: ${tone.bannedPhrases.join(', ') || 'None'}
- Language Rule: ${tone.languageMix || 'English default'}

POST TO AUDIT:
${JSON.stringify(version, null, 2)}

CRITICAL AUDIT TASKS:
1. RESULT FABRICATION / EXAGGERATION CHECK: Compare post claims directly against RAW INPUT NOTES. Did the post upgrade raw input results? (e.g. turning "dropped noticeably" or "improved" into "eliminated", "solved completely", or "instantly"? If so, flag FAIL).
2. DOs & DON'Ts COMPLIANCE: Audit every DO and DON'T listed above.
3. ANATOMY & STRUCTURE: Verify sections follow active order and instructions.
4. VOCABULARY SIMPLICITY: Check if the post uses any formal, corporate, or AI-sounding vocabulary from the avoid words list.
5. OVERALL RATING: If any ground truth metric failed (e.g. Hook word count > ${hookWordLimit}, character count out of bounds, banned phrase detected, forbidden AI vocabulary word detected) OR if there is result exaggeration/rule violation, overall result MUST be FAIL.

Output ONLY valid JSON (no markdown code blocks, no extra text):
{
  "overallResult": "PASS" | "FAIL",
  "auditReport": {
    "antiExaggerationCheck": { "status": "PASS" | "FAIL", "explanation": "..." },
    "hookWordCountCheck": { "status": "PASS" | "FAIL", "count": ${hookWordCount}, "limit": ${hookWordLimit}, "explanation": "..." },
    "characterCountCheck": { "status": "PASS" | "FAIL", "count": ${totalCharCount}, "range": "${activeFormat.min}-${activeFormat.max}", "explanation": "..." },
    "bannedPhrasesCheck": { "status": "PASS" | "FAIL", "found": ${JSON.stringify(bannedPhrasesFound)} },
    "vocabularyCheck": { "status": "PASS" | "FAIL", "found": ${JSON.stringify(avoidWordsFound)} },
    "anatomyCheck": { "status": "PASS" | "FAIL", "explanation": "..." },
    "dosCheck": [ { "rule": "...", "status": "PASS" | "FAIL", "evidence": "..." } ],
    "dontsCheck": [ { "rule": "...", "status": "PASS" | "FAIL", "evidence": "..." } ],
    "visualSuggestionCheck": { "status": "PASS" | "FAIL", "explanation": "..." }
  },
  "failureReasons": ["reason 1", "reason 2"]
}`;

    const jsonText = await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(auditPrompt);
      const text = result.response.text().trim();
      return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    });

    const auditData = JSON.parse(jsonText);

    // Merge JS ground truth status into overall result
    let finalOverall = auditData.overallResult;
    const finalFailures: string[] = Array.isArray(auditData.failureReasons) ? [...auditData.failureReasons] : [];

    if (!isHookWordCountValid) {
      finalOverall = 'FAIL';
      finalFailures.push(`Hook contains ${hookWordCount} words, exceeding the maximum limit of ${hookWordLimit} words.`);
    }
    if (!isCharCountValid) {
      finalOverall = 'FAIL';
      finalFailures.push(`Total character count (${totalCharCount}) is outside the target range [${activeFormat.min}, ${activeFormat.max}].`);
    }
    if (bannedPhrasesFound.length > 0) {
      finalOverall = 'FAIL';
      finalFailures.push(`Banned phrase(s) detected: ${bannedPhrasesFound.join(', ')}.`);
    }
    if (avoidWordsFound.length > 0) {
      finalOverall = 'FAIL';
      avoidWordsFound.forEach(item => {
        finalFailures.push(`Forbidden AI vocabulary word "${item.word}" detected in "${item.section}" section.`);
      });
    }
    if (missingAnatomySections.length > 0) {
      finalOverall = 'FAIL';
      finalFailures.push(`Missing anatomy section(s): ${missingAnatomySections.join(', ')}.`);
    }

    return NextResponse.json({
      overallResult: finalOverall,
      groundTruthMetrics,
      auditReport: auditData.auditReport || {},
      failureReasons: Array.from(new Set(finalFailures))
    });

  } catch (e) {
    console.error('audit-post error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
