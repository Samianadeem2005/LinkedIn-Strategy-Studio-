import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithGeminiFallback } from './gemini';

export interface CategoryItem {
  id: string;
  name: string;
  text: string;
  order_index?: number;
  embedding?: number[] | null;
}

export interface CategoryContext {
  postTypes: CategoryItem[];
  anatomySections: CategoryItem[];
  writingMechanics: CategoryItem[];
}

export interface ExtractedPoint {
  heading: string;
  point_text: string;
  target_table: 'post_types' | 'post_anatomy' | 'writing_mechanics' | 'hook_bank';
  is_new_category: boolean;
  target_row_id: string | null;
  suggested_order_index?: number | null;
}

export interface SemanticEvaluationResult {
  decision: 'suppress' | 'show_update' | 'error';
  reason: string;
}

/**
 * Generates a 3072-dimensional vector embedding for a given text using gemini-embedding-001.
 * Returns null if the embedding API fails (to distinguish errors from empty string input).
 */
export async function getEmbedding(text: string, apiKey?: string): Promise<number[] | null> {
  const clean = text.trim();
  if (!clean) return [];

  try {
    return await callWithGeminiFallback(async (genAI) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const result = await model.embedContent(clean.slice(0, 2000));
      return result.embedding.values || [];
    });
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    console.error('[EMBEDDING API ERROR] gemini-embedding-001 failed:', errMsg);
    return null;
  }
}

/**
 * Calculates Cosine Similarity score between two vector arrays.
 * Score ranges from 0.0 (unrelated) to 1.0 (identical semantic vector).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Splits raw text into chunks of roughly 1500-2000 words.
 * Prefers splitting on paragraph or double-newline boundaries.
 */
export function chunkText(text: string, targetWordCount: number = 1800): string[] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const paragraphs = cleanText.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).filter(Boolean).length;
    if (currentWordCount + paraWords > targetWordCount && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [para];
      currentWordCount = paraWords;
    } else {
      currentChunk.push(para);
      currentWordCount += paraWords;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}

export async function getCategoryContextWithEmbeddings(apiKey?: string): Promise<CategoryContext> {
  const db = getDb();

  const postTypesRaw = db.prepare('SELECT id, name, core_focus FROM post_types').all() as { id: string; name: string; core_focus: string }[];
  const anatomySectionsRaw = db.prepare('SELECT id, section_name as name, rule_description, order_index FROM post_anatomy ORDER BY order_index ASC').all() as { id: string; name: string; rule_description: string; order_index: number }[];
  const writingMechanicsRaw = db.prepare('SELECT id, rule_name as name, prompt_directive, order_index FROM writing_mechanics ORDER BY order_index ASC').all() as { id: string; name: string; prompt_directive: string; order_index: number }[];

  const postTypes: CategoryItem[] = await Promise.all(
    postTypesRaw.map(async p => ({
      id: p.id,
      name: p.name,
      text: p.core_focus || p.name,
      embedding: await getEmbedding(`${p.name}: ${p.core_focus || ''}`)
    }))
  );

  const anatomySections: CategoryItem[] = await Promise.all(
    anatomySectionsRaw.map(async a => ({
      id: a.id,
      name: a.name,
      text: a.rule_description || a.name,
      order_index: a.order_index,
      embedding: await getEmbedding(`${a.name}: ${a.rule_description || ''}`)
    }))
  );

  const writingMechanics: CategoryItem[] = await Promise.all(
    writingMechanicsRaw.map(async w => ({
      id: w.id,
      name: w.name,
      text: w.prompt_directive || w.name,
      order_index: w.order_index,
      embedding: await getEmbedding(`${w.name}: ${w.prompt_directive || ''}`)
    }))
  );

  return { postTypes, anatomySections, writingMechanics };
}

/**
 * Generates a clean, readable executive summary outline of the raw strategy text.
 */
export async function generateCleanSummary(rawText: string): Promise<string> {
  try {
    return await callWithGeminiFallback(async (genAI) => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `You are a world-class LinkedIn Content Strategist. Summarize the following raw strategy text into a clean, beautifully formatted bulleted outline.
Use clear headings and concise bullet points in plain language so a reader can instantly get the core takeaways.

RAW STRATEGY TEXT:
${rawText.slice(0, 8000)}

Output ONLY clean Markdown formatted outline (headings and bullet points). Do not include introductory conversational filler.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });
  } catch (e) {
    console.error('Failed to generate clean summary:', e);
    return 'Summary unavailable.';
  }
}

export async function extractFromChunk(
  chunkTextContent: string,
  context: CategoryContext
): Promise<ExtractedPoint[]> {
  return await callWithGeminiFallback(async (genAI) => {
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a high-level LinkedIn Content Strategist auditing a text excerpt for rules, frameworks, hooks, and content structures.

EXCERPT TO PROCESS:
${chunkTextContent}

EXISTING CATEGORIES IN USER'S DATABASE (with their current text and order sequence):
- Post Types (Pillars):
  ${context.postTypes.length ? context.postTypes.map(p => `• ${p.name} (id: "${p.id}") -> Current Text: "${p.text}"`).join('\n  ') : 'None'}

- Post Anatomy Sections (CURRENT SEQUENTIAL ORDER):
  ${context.anatomySections.length ? context.anatomySections.map(a => `${a.order_index ?? '?'}. ${a.name} (id: "${a.id}") -> Rule: "${a.text}"`).join('\n  ') : 'None'}

- Writing Mechanics Rules:
  ${context.writingMechanics.length ? context.writingMechanics.map(w => `• ${w.name} (id: "${w.id}") -> Directive: "${w.text}"`).join('\n  ') : 'None'}

INSTRUCTIONS:
1. Extract concrete, actionable content strategy points, rules, anatomy guidelines, hooks, or mechanics from the excerpt.
2. Determine target_table: 'post_types' | 'post_anatomy' | 'writing_mechanics' | 'hook_bank'.
3. If it matches an existing item in name or intent, set is_new_category: false and target_row_id to that item's id. Otherwise set is_new_category: true, target_row_id: null.
4. SMART LOGICAL ORDERING FOR POST ANATOMY:
   If an item belongs to 'post_anatomy':
   - Examine the CURRENT POST ANATOMY SECTIONS listed above in sequential order.
   - If the strategy text explicitly states an ordering clue (e.g. "second line", "rehook", "after hook", "3rd step", "conclusion"), assign that exact 1-based integer to suggested_order_index (e.g. 2 for "Rehook - Second Line").
   - IF NO EXPLICIT ORDER IS MENTIONED IN THE TEXT: Analyze the old anatomy sequence (1. Hook, 2. Context, etc.) and let the AI propose the most logical placement position integer for where this section fits best in the post flow. Do NOT output any reason or explanation text—ONLY return the 1-based integer in suggested_order_index.
5. Output ONLY valid JSON:

{
  "points": [
    {
      "heading": "short concise label for this point",
      "point_text": "the clear, practical rule or extracted content",
      "target_table": "post_types | post_anatomy | writing_mechanics | hook_bank",
      "is_new_category": true,
      "target_row_id": null,
      "suggested_order_index": 2
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text().trim();
    const jsonText = rawResponse.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.points)) return [];
      return parsed.points as ExtractedPoint[];
    } catch (e) {
      console.error('Failed to parse Gemini extraction JSON:', e, rawResponse);
      return [];
    }
  });
}

/**
 * Strict Layer 2 LLM Semantic Comparison:
 * Uses few-shot calibrated examples + self-check pass to distinguish genuine content changes from synonym/rewording noise.
 * Temperature is set to 0.1 for consistency — this is a judgment call, not a creative task.
 */
export async function evaluateSemanticUpdate(beforeText: string, afterText: string): Promise<SemanticEvaluationResult> {
  console.log('\n================================================================================');
  console.log('--- STEP 8: CACHING CHECK ---');
  console.log('Checking cache/dedup layer for evaluateSemanticUpdate...');
  console.log('Result: Fresh evaluation. No content-hash cache or DB cache layer exists for evaluateSemanticUpdate.');

  if (!beforeText || beforeText.trim() === 'None') {
    console.log('[TRACE] BEFORE text is empty or "None" -> Skipping LLM comparison, decision: "show_update"');
    return { decision: 'show_update', reason: 'No prior DB rule exists.' };
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const genConfig = { temperature: 0.1 };

  console.log('\n--- STEP 3: API CALL PARAMETERS ---');
  console.log(`Target Model Name: "${modelName}"`);
  console.log(`Payload generationConfig:`, JSON.stringify(genConfig, null, 2));

  const prompt = `You are comparing two versions of the same strategy rule to decide if the change is meaningful enough to show a human for review.

BEFORE (current rule in database):
${beforeText}

AFTER (newly extracted text, already matched to this rule via vector similarity):
${afterText}

DEFINITION: A "concrete element" is a specific number, threshold, named technique, example, or instruction that would make someone DO something differently in practice. Synonyms, different adjectives, reordered sentences, or restating the same instruction in other words are NEVER concrete elements, even if the wording looks quite different.

EXAMPLES (study these carefully before answering):

Example A:
BEFORE: "Prevent single, isolated words from wrapping onto a line by themselves."
AFTER: "Prevent single dangling words from wrapping onto a line by themselves to preserve clean presentation."
→ "isolated" vs "dangling", "protect" vs "preserve" are synonyms. No new number, no new rule. decision: suppress

Example B:
BEFORE: "Use aggressive whitespace between lines."
AFTER: "Use generous whitespace between lines and paragraphs to keep sections airy."
→ "aggressive" vs "generous" is a synonym swap, "and paragraphs"/"airy" adds descriptive color but no new actionable rule. decision: suppress

Example C:
BEFORE: "Keep sentences under 12 words."
AFTER: "Keep sentences under 15 words and avoid passive voice."
→ The word-count threshold changed (12 → 15) AND a new instruction (avoid passive voice) was added. Both are concrete elements. decision: show_update

Example D:
BEFORE: "End posts with a thought-provoking question; never use generic prompts like 'let me know your thoughts.'"
AFTER: "End posts with a thought-provoking question."
→ The instruction to avoid generic prompts is missing from AFTER — that is a concrete element being lost. decision: show_update

Now apply the same standard to the real BEFORE/AFTER pair above.

STEP 1 — List every concrete element (per the definition above) in AFTER that is NOT in BEFORE. For each candidate, explicitly ask: "is this just a synonym or rewording of something already in BEFORE?" — if yes, do not include it.

STEP 2 — List every concrete element in BEFORE that is missing from AFTER (would be lost if AFTER replaced BEFORE).

STEP 3 — Self-check: re-read your Step 1 and Step 2 lists one more time. Remove any entry that is only a different word choice for the same instruction, rather than an actual change in what to do.

STEP 4 — Decide:
- Both lists empty after self-check → decision: "suppress"
- Either list still has a genuine entry → decision: "show_update"

Respond with ONLY this JSON, no extra text:
{"decision": "suppress" | "show_update", "reason": "name the specific concrete element(s), or state 'pure rewording, no concrete change' if suppressing"}`;

  console.log('\n--- STEP 2: EXACT PROMPT SENT TO GEMINI ---');
  console.log('----------------------- BEGIN LITERAL PROMPT -----------------------');
  console.log(prompt);
  console.log('------------------------ END LITERAL PROMPT ------------------------');

  try {
    console.log('\n--- STEP 4 & 7: RAW MODEL RESPONSE & TRY/CATCH MONITORING ---');
    const rawText = await callWithGeminiFallback(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: genConfig
      });
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    console.log('[TRY/CATCH CHECK]: API call completed successfully without throwing exception.');
    console.log('------------------- BEGIN RAW GEMINI RESPONSE -------------------');
    console.log(rawText);
    console.log('-------------------- END RAW GEMINI RESPONSE --------------------');

    console.log('\n--- STEP 5: PARSED DECISION OBJECT ---');
    const jsonText = rawText.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    console.log(`Cleaned JSON String prior to parse: "${jsonText}"`);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
      console.log('JSON.parse Succeeded! Parsed Object:', parsed);
    } catch (parseErr: any) {
      const errMsg = `JSON parse failure on model response: ${parseErr?.message || parseErr}`;
      console.error('--- STEP 7: ERROR/FALLBACK TRIGGERED ---');
      console.error('JSON.parse failed on model output:', parseErr);
      return { decision: 'error', reason: errMsg };
    }

    const decisionObj: SemanticEvaluationResult = {
      decision: parsed.decision === 'suppress' ? 'suppress' : 'show_update',
      reason: parsed.reason || ''
    };
    console.log('Final Evaluated Decision Object:', decisionObj);
    return decisionObj;
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    console.error('\n--- STEP 7: ERROR/FALLBACK TRIGGERED ---');
    console.error('evaluateSemanticUpdate caught error in try/catch block:', e);
    return { decision: 'error', reason: `LLM API Error: ${errMsg}` };
  }
}

export async function processIngestionDump(dumpId: string, rawText: string) {
  const db = getDb();

  // Update status to processing
  db.prepare("UPDATE knowledge_dumps SET status = 'processing' WHERE id = ?").run(dumpId);

  // Generate clean summary and update dump row
  const cleanSummary = await generateCleanSummary(rawText);
  db.prepare('UPDATE knowledge_dumps SET clean_summary = ? WHERE id = ?').run(cleanSummary, dumpId);

  const chunks = chunkText(rawText);
  const context = await getCategoryContextWithEmbeddings();

  const insertReviewStmt = db.prepare(`
    INSERT INTO extraction_review (id, dump_id, heading, point_text, target_table, is_new_category, target_row_id, apply_mode, user_decision, suggested_order_index, created_at, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'merge', ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  // Process chunks in small concurrent batches of 3
  const batchSize = 3;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const rawResults = await Promise.all(
      batch.map(chunk => extractFromChunk(chunk, context))
    );

    for (const points of rawResults) {
      for (const pt of points) {
        // --- HYBRID VECTOR STAGE ---
        console.log('\n--- STEP 1: VECTOR STAGE ---');
        console.log(`Processing extracted candidate point: "${pt.heading}"`);
        console.log(`Candidate AFTER text: "${pt.point_text}"`);

        const pointEmbedding = await getEmbedding(pt.point_text);

        // Explicit error handling: If embedding fails, mark decision as error with clear log
        if (pointEmbedding === null) {
          console.error(`[EMBEDDING ERROR] Could not generate embedding for point "${pt.heading}". Storing as decision='error'.`);
          insertReviewStmt.run(
            uuidv4(),
            dumpId,
            pt.heading || 'Extracted Rule',
            pt.point_text || '',
            pt.target_table || 'writing_mechanics',
            pt.is_new_category ? 1 : 0,
            pt.target_row_id || null,
            'error',
            (pt.target_table === 'post_anatomy' && pt.suggested_order_index) ? Number(pt.suggested_order_index) : null,
            now,
            'Embedding API call failed (gemini-embedding-001)'
          );
          continue;
        }

        let candidateList: CategoryItem[] = [];
        if (pt.target_table === 'post_types') candidateList = context.postTypes;
        else if (pt.target_table === 'post_anatomy') candidateList = context.anatomySections;
        else if (pt.target_table === 'writing_mechanics') candidateList = context.writingMechanics;

        let bestMatch: CategoryItem | null = null;
        let highestScore = 0;

        if (pointEmbedding.length > 0) {
          for (const item of candidateList) {
            if (item.embedding && item.embedding.length > 0) {
              const score = cosineSimilarity(pointEmbedding, item.embedding);
              if (score > highestScore) {
                highestScore = score;
                bestMatch = item;
              }
            }
          }
        }

        console.log(`Computed Cosine Similarity Score: ${highestScore.toFixed(4)}`);
        console.log(`Similarity Threshold: 0.80`);
        if (highestScore > 0.80 && bestMatch) {
          console.log(`Crosses Threshold (> 0.80)? YES -> Matched to existing DB row ID "${bestMatch.id}" ("${bestMatch.name}")`);
          console.log(`Matched BEFORE text: "${bestMatch.text}"`);
        } else {
          console.log(`Crosses Threshold (> 0.80)? NO -> Candidate vector score: ${highestScore.toFixed(4)} did not reach 0.80 threshold.`);
        }

        let isNew = pt.is_new_category;
        let targetRowId = pt.target_row_id;
        let currentText = '';

        if (highestScore > 0.80 && bestMatch) {
          isNew = false;
          targetRowId = bestMatch.id;
          currentText = bestMatch.text;
        } else if (targetRowId && !isNew) {
          const matchedItem = candidateList.find(c => c.id === targetRowId);
          if (matchedItem) currentText = matchedItem.text;
        }

        const suggestedOrder = (pt.target_table === 'post_anatomy' && pt.suggested_order_index)
          ? Number(pt.suggested_order_index)
          : null;

        // --- STRICT HYBRID LLM REVIEW STEP ---
        if (!isNew && targetRowId) {
          const evalResult = await evaluateSemanticUpdate(currentText, pt.point_text);

          console.log('\n--- STEP 6: POST-DECISION BRANCHING ---');
          console.log(`Evaluated Decision: "${evalResult.decision}"`);
          if (evalResult.decision === 'suppress') {
            console.log(`[BRANCH EXECUTED]: decision === 'suppress' -> Auto-suppressing pure paraphrase update for "${pt.heading}": ${evalResult.reason}`);
            console.log(`[BRANCH EXECUTED]: Executed 'continue;' -> SKIPPED insertReviewStmt.run()`);
            console.log(`-> Item was NOT inserted into extraction_review table!`);
            continue;
          } else if (evalResult.decision === 'error') {
            console.error(`[BRANCH EXECUTED]: decision === 'error' -> Marking error for point "${pt.heading}": ${evalResult.reason}`);
            insertReviewStmt.run(
              uuidv4(),
              dumpId,
              pt.heading || 'Extracted Rule',
              pt.point_text || '',
              pt.target_table || 'writing_mechanics',
              0,
              targetRowId,
              'error',
              suggestedOrder,
              now,
              evalResult.reason
            );
            continue;
          } else {
            console.log(`[BRANCH EXECUTED]: decision === 'show_update' -> Proceeding to insertReviewStmt.run()`);
            console.log(`-> Item WAS inserted into extraction_review table as a card in UI!`);
          }
        } else {
          console.log('\n--- STEP 6: POST-DECISION BRANCHING ---');
          console.log(`Item evaluated as NEW category (isNew: ${isNew}, targetRowId: ${targetRowId}). Skipping evaluateSemanticUpdate.`);
          console.log(`[BRANCH EXECUTED]: Proceeding to insertReviewStmt.run() as new item.`);
        }

        const initialDecision = isNew ? 'keep' : 'keep_previous';

        insertReviewStmt.run(
          uuidv4(),
          dumpId,
          pt.heading || 'Extracted Rule',
          pt.point_text || '',
          pt.target_table || 'writing_mechanics',
          isNew ? 1 : 0,
          targetRowId || null,
          initialDecision,
          suggestedOrder,
          now,
          null
        );
      }
    }
  }

  // Update status to reviewed
  db.prepare("UPDATE knowledge_dumps SET status = 'reviewed' WHERE id = ?").run(dumpId);
}

