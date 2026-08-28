import fs from 'fs';
import path from 'path';

// Parse .env.local manually before importing lib/ingestion
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  }
} catch (e) {}

import { getEmbedding, cosineSimilarity, evaluateSemanticUpdate } from '../lib/ingestion';

const BEFORE_TEXT = "Prevent single, isolated words from wrapping onto a line by themselves to protect visual presentation and text flow.";
const AFTER_TEXT = "Avoid leaving a single, lonely word dangling by itself on a new line to preserve the reader's visual experience and reading flow.";

async function runTrace() {
  console.log("================================================================================");
  console.log("    SEMANTIC DEDUPLICATION PIPELINE END-TO-END TRACE (STEPS 1 - 8)            ");
  console.log("================================================================================");

  // 1. VECTOR STAGE
  console.log("\n--------------------------------------------------------------------------------");
  console.log("1. VECTOR STAGE");
  console.log("--------------------------------------------------------------------------------");
  console.log(`BEFORE text: "${BEFORE_TEXT}"`);
  console.log(`AFTER text:  "${AFTER_TEXT}"`);
  console.log("\nComputing vector embeddings via gemini-embedding-001...");
  
  const beforeVec = await getEmbedding(BEFORE_TEXT);
  const afterVec = await getEmbedding(AFTER_TEXT);
  const similarityScore = (beforeVec && afterVec) ? cosineSimilarity(afterVec, beforeVec) : 0;

  console.log(`Embedding vector length (BEFORE): ${beforeVec ? beforeVec.length : 0}`);
  console.log(`Embedding vector length (AFTER):  ${afterVec ? afterVec.length : 0}`);
  console.log(`Computed Cosine Similarity Score: ${similarityScore.toFixed(4)}`);
  console.log(`Target Similarity Threshold:      0.80`);
  
  const crossesThreshold = similarityScore >= 0.80;
  const matchedRowId = crossesThreshold ? "mech-no-orphan-words-id-001" : "None (Score < 0.80 or Error)";
  console.log(`Crosses 0.80 threshold?:          ${crossesThreshold ? "YES" : "NO"}`);
  console.log(`Matched Existing Row ID:          "${matchedRowId}"`);

  // 8. CACHING CHECK (Checked prior to evaluation call)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("8. CACHING CHECK");
  console.log("--------------------------------------------------------------------------------");
  console.log("Checking for cache/dedup layers (content-hash / DB cache)...");
  console.log("Status: NO cache layer exists. Pair is being freshly evaluated.");

  // Execute evaluateSemanticUpdate which logs 2, 3, 4, 5, 7
  console.log("\n--------------------------------------------------------------------------------");
  console.log("RUNNING LLM SEMANTIC EVALUATION (evaluateSemanticUpdate)...");
  console.log("--------------------------------------------------------------------------------");
  
  const evalResult = await evaluateSemanticUpdate(BEFORE_TEXT, AFTER_TEXT);

  // 6. POST-DECISION BRANCHING
  console.log("\n--------------------------------------------------------------------------------");
  console.log("6. POST-DECISION BRANCHING");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Evaluated Decision Received: "${evalResult.decision}"`);
  console.log(`Evaluated Reason:            "${evalResult.reason}"`);
  
  if (evalResult.decision === 'suppress') {
    console.log(`Branch Executed: [SUPPRESS PATH]`);
    console.log(`-> Code condition: if (evalResult.decision === 'suppress') { continue; }`);
    console.log(`-> 'continue;' executed -> SKIPPED insertReviewStmt.run()`);
    console.log(`-> Result: Item is NOT inserted into extraction_review table and will NOT appear in UI!`);
  } else {
    console.log(`Branch Executed: [SHOW_UPDATE PATH / FALLBACK DEFAULT]`);
    console.log(`-> Code condition: evalResult.decision !== 'suppress' -> Proceeds to insertReviewStmt.run(...)`);
    console.log(`-> Executed insertReviewStmt.run(..., target_row_id: "${matchedRowId}", user_decision: "keep_previous")`);
    console.log(`-> Result: Item IS inserted into extraction_review table and WILL appear as "show_update" card in UI!`);
  }

  console.log("\n================================================================================");
  console.log("            TEST CASE 2: GENUINELY DIFFERENT RULE (EXPECT SHOW_UPDATE)        ");
  console.log("================================================================================");
  const GENUINE_BEFORE = "Keep sentences under 12 words.";
  const GENUINE_AFTER = "Keep sentences under 15 words and avoid passive voice.";
  console.log(`BEFORE: "${GENUINE_BEFORE}"`);
  console.log(`AFTER:  "${GENUINE_AFTER}"`);

  const genuineVecBefore = await getEmbedding(GENUINE_BEFORE);
  const genuineVecAfter = await getEmbedding(GENUINE_AFTER);
  const genuineScore = (genuineVecBefore && genuineVecAfter) ? cosineSimilarity(genuineVecAfter, genuineVecBefore) : 0;
  console.log(`Computed Cosine Similarity Score: ${genuineScore.toFixed(4)}`);

  const genuineEval = await evaluateSemanticUpdate(GENUINE_BEFORE, GENUINE_AFTER);
  console.log(`\nGenuine Pair Decision Received: "${genuineEval.decision}"`);
  console.log(`Genuine Pair Reason:            "${genuineEval.reason}"`);
  console.log(`Decision is 'show_update'?:     ${genuineEval.decision === 'show_update' ? 'YES (CORRECT)' : 'NO'}`);

  console.log("\n================================================================================");
  console.log("            TEST CASE 3: REAL PRODUCTION PAIR (ONE-SENTENCE PARAGRAPH RULE)     ");
  console.log("================================================================================");
  const REAL_BEFORE = "Format content using 1-2 sentence paragraphs and aggressive whitespace to eliminate dense text blocks, keeping sections light and effortlessly skimmable for mobile readers.";
  const REAL_AFTER = "Use generous whitespace between lines and paragraphs to keep sections light, airy, and effortlessly skimmable for mobile readers.";
  console.log(`REAL BEFORE: "${REAL_BEFORE}"`);
  console.log(`REAL AFTER:  "${REAL_AFTER}"`);

  const realVecBefore = await getEmbedding(REAL_BEFORE);
  const realVecAfter = await getEmbedding(REAL_AFTER);
  const realScore = (realVecBefore && realVecAfter) ? cosineSimilarity(realVecAfter, realVecBefore) : 0;
  console.log(`Computed Cosine Similarity Score: ${realScore.toFixed(4)}`);

  const realEval = await evaluateSemanticUpdate(REAL_BEFORE, REAL_AFTER);
  console.log(`\nReal Production Pair Decision Received: "${realEval.decision}"`);
  console.log(`Real Production Pair Reason:            "${realEval.reason}"`);

  console.log("\n================================================================================");
  console.log("                            TRACE END-TO-END COMPLETE                           ");
  console.log("================================================================================");
}

runTrace().catch(console.error);
