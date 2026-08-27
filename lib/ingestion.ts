import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CategoryItem {
  id: string;
  name: string;
  text: string;
  embedding?: number[];
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
}

/**
 * Generates a 768-dimensional vector embedding for a given text using text-embedding-004.
 */
export async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const clean = text.trim();
  if (!clean) return [];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(clean.slice(0, 2000));
    return result.embedding.values || [];
  } catch (e) {
    console.error('Failed to generate vector embedding:', e);
    return [];
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

export async function getCategoryContextWithEmbeddings(apiKey: string): Promise<CategoryContext> {
  const db = getDb();

  const postTypesRaw = db.prepare('SELECT id, name, core_focus FROM post_types').all() as { id: string; name: string; core_focus: string }[];
  const anatomySectionsRaw = db.prepare('SELECT id, section_name as name, rule_description FROM post_anatomy').all() as { id: string; name: string; rule_description: string }[];
  const writingMechanicsRaw = db.prepare('SELECT id, rule_name as name, prompt_directive FROM writing_mechanics').all() as { id: string; name: string; prompt_directive: string }[];

  const postTypes: CategoryItem[] = await Promise.all(
    postTypesRaw.map(async p => ({
      id: p.id,
      name: p.name,
      text: p.core_focus || p.name,
      embedding: await getEmbedding(`${p.name}: ${p.core_focus || ''}`, apiKey)
    }))
  );

  const anatomySections: CategoryItem[] = await Promise.all(
    anatomySectionsRaw.map(async a => ({
      id: a.id,
      name: a.name,
      text: a.rule_description || a.name,
      embedding: await getEmbedding(`${a.name}: ${a.rule_description || ''}`, apiKey)
    }))
  );

  const writingMechanics: CategoryItem[] = await Promise.all(
    writingMechanicsRaw.map(async w => ({
      id: w.id,
      name: w.name,
      text: w.prompt_directive || w.name,
      embedding: await getEmbedding(`${w.name}: ${w.prompt_directive || ''}`, apiKey)
    }))
  );

  return { postTypes, anatomySections, writingMechanics };
}

/**
 * Generates a clean, readable executive summary outline of the raw strategy text.
 */
export async function generateCleanSummary(rawText: string, apiKey: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a world-class LinkedIn Content Strategist. Summarize the following raw strategy text into a clean, beautifully formatted bulleted outline.
Use clear headings and concise bullet points in plain language so a reader can instantly get the core takeaways.

RAW STRATEGY TEXT:
${rawText.slice(0, 8000)}

Output ONLY clean Markdown formatted outline (headings and bullet points). Do not include introductory conversational filler.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error('Failed to generate clean summary:', e);
    return 'Summary unavailable.';
  }
}

export async function extractFromChunk(
  chunkTextContent: string,
  context: CategoryContext,
  apiKey: string
): Promise<ExtractedPoint[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are a high-level LinkedIn Content Strategist auditing a text excerpt for rules, frameworks, hooks, and content structures.

EXCERPT TO PROCESS:
${chunkTextContent}

EXISTING CATEGORIES IN USER'S DATABASE (with their current rule text):
- Post Types (Pillars):
  ${context.postTypes.length ? context.postTypes.map(p => `• ${p.name} (id: "${p.id}") -> Current Text: "${p.text}"`).join('\n  ') : 'None'}

- Post Anatomy Sections:
  ${context.anatomySections.length ? context.anatomySections.map(a => `• ${a.name} (id: "${a.id}") -> Current Text: "${a.text}"`).join('\n  ') : 'None'}

- Writing Mechanics Rules:
  ${context.writingMechanics.length ? context.writingMechanics.map(w => `• ${w.name} (id: "${w.id}") -> Current Text: "${w.text}"`).join('\n  ') : 'None'}

INSTRUCTIONS:
1. Extract concrete, actionable content strategy points, rules, anatomy guidelines, hooks, or mechanics from the excerpt.
2. Determine target_table: 'post_types' | 'post_anatomy' | 'writing_mechanics' | 'hook_bank'.
3. If it matches an existing item in name or intent, set is_new_category: false and target_row_id to that item's id. Otherwise set is_new_category: true, target_row_id: null.
4. Output ONLY valid JSON:

{
  "points": [
    {
      "heading": "short concise label for this point",
      "point_text": "the clear, practical rule or extracted content",
      "target_table": "post_types | post_anatomy | writing_mechanics | hook_bank",
      "is_new_category": true,
      "target_row_id": null
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
}

/**
 * Hybrid LLM Review step: Checks if BEFORE and AFTER are 100% duplicate paraphrases.
 */
async function isDuplicateParaphrase(beforeText: string, afterText: string, apiKey: string): Promise<boolean> {
  if (!beforeText || beforeText.trim() === 'None') return false;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Compare these two rule directives:

EXISTING RULE (BEFORE):
${beforeText}

NEW PROPOSED RULE (AFTER):
${afterText}

QUESTION: Does the NEW PROPOSED RULE express the exact same meaning, instruction, or guideline as the EXISTING RULE without adding any new rule, constraint, number, or actionable direction? (i.e. is it just reworded or paraphrased filler?)

Answer ONLY "YES" if it is a duplicate paraphrase with no new information, or "NO" if it contains genuinely new instructions or guidelines.`;

    const res = await model.generateContent(prompt);
    const ans = res.response.text().trim().toUpperCase();
    return ans.includes('YES');
  } catch {
    return false;
  }
}

export async function processIngestionDump(dumpId: string, rawText: string) {
  const db = getDb();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set.');

  // Update status to processing
  db.prepare("UPDATE knowledge_dumps SET status = 'processing' WHERE id = ?").run(dumpId);

  // Generate clean summary and update dump row
  const cleanSummary = await generateCleanSummary(rawText, apiKey);
  db.prepare('UPDATE knowledge_dumps SET clean_summary = ? WHERE id = ?').run(cleanSummary, dumpId);

  const chunks = chunkText(rawText);
  const context = await getCategoryContextWithEmbeddings(apiKey);

  const insertReviewStmt = db.prepare(`
    INSERT INTO extraction_review (id, dump_id, heading, point_text, target_table, is_new_category, target_row_id, apply_mode, user_decision, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'merge', ?, ?)
  `);

  const now = new Date().toISOString();

  // Process chunks in small concurrent batches of 3
  const batchSize = 3;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const rawResults = await Promise.all(
      batch.map(chunk => extractFromChunk(chunk, context, apiKey))
    );

    for (const points of rawResults) {
      for (const pt of points) {
        // --- HYBRID VECTOR SEARCH ENGINE ---
        // Generate embedding for extracted point
        const pointEmbedding = await getEmbedding(pt.point_text, apiKey);

        // Select candidate list based on target_table
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

        // Apply Hybrid Vector Threshold (> 0.80 Cosine Similarity Score)
        let isNew = pt.is_new_category;
        let targetRowId = pt.target_row_id;
        let currentText = '';

        if (highestScore > 0.80 && bestMatch) {
          // Vector embedding confirmed high semantic similarity! Map to this existing row
          isNew = false;
          targetRowId = bestMatch.id;
          currentText = bestMatch.text;
        } else if (targetRowId && !isNew) {
          // LLM matched an ID directly
          const matchedItem = candidateList.find(c => c.id === targetRowId);
          if (matchedItem) currentText = matchedItem.text;
        }

        // --- HYBRID LLM REVIEW STEP ---
        // If it's an update to an existing row, verify if it's a 100% duplicate paraphrase
        if (!isNew && targetRowId) {
          const duplicate = await isDuplicateParaphrase(currentText, pt.point_text, apiKey);
          if (duplicate) {
            // Suppress duplicate paraphrase entirely!
            continue;
          }
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
          now
        );
      }
    }
  }

  // Update status to reviewed
  db.prepare("UPDATE knowledge_dumps SET status = 'reviewed' WHERE id = ?").run(dumpId);
}
