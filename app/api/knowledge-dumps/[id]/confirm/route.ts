import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function mergeRulesWithAI(beforeText: string, afterText: string, apiKey: string): Promise<string> {
  if (!beforeText || beforeText.trim() === 'No current rule set.') return afterText;
  if (!afterText) return beforeText;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a LinkedIn Content Strategy Editor. Combine these two content directives into ONE clean, non-repetitive, concise, high-impact rule directive. Eliminate duplicate wording and resolve any minor contradictions.

EXISTING RULE (BEFORE):
${beforeText}

NEW PROPOSED RULE (AFTER):
${afterText}

Output ONLY the final merged directive string. No intro, no quotes, no markdown wrappers.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error('Failed to merge rules with AI, falling back to merge concatenation:', e);
    return `${beforeText} | ${afterText}`;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const apiKey = process.env.GEMINI_API_KEY;

    const dump = db.prepare('SELECT * FROM knowledge_dumps WHERE id = ?').get(id);
    if (!dump) {
      return NextResponse.json({ error: 'Knowledge dump not found.' }, { status: 404 });
    }

    // Retrieve items marked for insertion (is_new_category = 1 & user_decision = 'keep')
    // OR marked for updating (is_new_category = 0 & user_decision = 'apply_update')
    const confirmItems = db.prepare(`
      SELECT * FROM extraction_review 
      WHERE dump_id = ? 
        AND ((is_new_category = 1 AND user_decision = 'keep')
          OR (is_new_category = 0 AND user_decision = 'apply_update'))
    `).all(id) as Record<string, unknown>[];

    if (confirmItems.length === 0) {
      return NextResponse.json({ message: 'No items selected for confirmation.', appliedCount: 0, summaryMessage: 'No updates or new items were selected.' }, { status: 200 });
    }

    let pillarsCount = 0;
    let anatomyCount = 0;
    let mechanicsCount = 0;
    let hooksCount = 0;

    for (const item of confirmItems) {
      const targetTable = item.target_table as string;
      const isNew = Number(item.is_new_category) === 1;
      const targetRowId = item.target_row_id as string | null;
      const heading = item.heading as string;
      const pointText = item.point_text as string;
      const applyMode = (item.apply_mode as string) || 'merge';

      if (targetTable === 'writing_mechanics') {
        if (isNew || !targetRowId) {
          const maxOrderObj = db.prepare('SELECT MAX(order_index) as m FROM writing_mechanics').get() as { m: number | null };
          const maxOrder = (maxOrderObj?.m ?? -1) + 1;
          db.prepare(`
            INSERT INTO writing_mechanics (id, rule_name, description, prompt_directive, enabled, order_index)
            VALUES (?, ?, ?, ?, 1, ?)
          `).run(uuidv4(), heading, pointText, pointText, maxOrder);
        } else {
          const existingRow = db.prepare('SELECT prompt_directive, description FROM writing_mechanics WHERE id = ?').get(targetRowId) as { prompt_directive: string; description: string } | undefined;
          const beforeText = existingRow?.prompt_directive || existingRow?.description || '';

          let finalText = pointText;
          if (applyMode === 'merge' && apiKey) {
            finalText = await mergeRulesWithAI(beforeText, pointText, apiKey);
          }

          db.prepare(`
            UPDATE writing_mechanics
            SET description = ?, prompt_directive = ?
            WHERE id = ?
          `).run(finalText, finalText, targetRowId);
        }
        mechanicsCount++;
      } else if (targetTable === 'hook_bank') {
        if (isNew || !targetRowId) {
          db.prepare(`
            INSERT INTO hook_bank (id, hook_text, category, source, used_count)
            VALUES (?, ?, ?, ?, 0)
          `).run(uuidv4(), pointText, heading || 'general', `Ingested Dump ${id.slice(0, 8)}`);
        } else {
          const existingRow = db.prepare('SELECT hook_text FROM hook_bank WHERE id = ?').get(targetRowId) as { hook_text: string } | undefined;
          const beforeText = existingRow?.hook_text || '';

          let finalText = pointText;
          if (applyMode === 'merge' && apiKey) {
            finalText = await mergeRulesWithAI(beforeText, pointText, apiKey);
          }

          db.prepare('UPDATE hook_bank SET hook_text = ? WHERE id = ?').run(finalText, targetRowId);
        }
        hooksCount++;
      } else if (targetTable === 'post_anatomy') {
        if (isNew || !targetRowId) {
          const maxOrderObj = db.prepare('SELECT MAX(order_index) as m FROM post_anatomy').get() as { m: number | null };
          const maxOrder = (maxOrderObj?.m ?? -1) + 1;
          db.prepare(`
            INSERT INTO post_anatomy (id, section_name, rule_description, order_index, applies_to_post_type_id)
            VALUES (?, ?, ?, ?, NULL)
          `).run(uuidv4(), heading, pointText, maxOrder);
        } else {
          const existingRow = db.prepare('SELECT rule_description FROM post_anatomy WHERE id = ?').get(targetRowId) as { rule_description: string } | undefined;
          const beforeText = existingRow?.rule_description || '';

          let finalText = pointText;
          if (applyMode === 'merge' && apiKey) {
            finalText = await mergeRulesWithAI(beforeText, pointText, apiKey);
          }

          db.prepare('UPDATE post_anatomy SET rule_description = ? WHERE id = ?').run(finalText, targetRowId);
        }
        anatomyCount++;
      } else if (targetTable === 'post_types') {
        if (isNew || !targetRowId) {
          const extractedLines = pointText.split('\n').map(l => l.replace(/^[•\-*✓✗]\s*/, '').trim()).filter(Boolean);
          const dosList = extractedLines.length > 0 ? extractedLines : [pointText];
          const dontsList = ['Avoid generic filler', 'Avoid off-brand tone'];

          db.prepare(`
            INSERT INTO post_types (id, name, dos, donts, core_focus)
            VALUES (?, ?, ?, ?, ?)
          `).run(uuidv4(), heading, JSON.stringify(dosList), JSON.stringify(dontsList), pointText);
        } else {
          const existingPt = db.prepare('SELECT * FROM post_types WHERE id = ?').get(targetRowId) as Record<string, unknown> | undefined;
          if (existingPt) {
            const beforeCoreFocus = (existingPt.core_focus as string) || '';
            let finalCoreFocus = pointText;

            if (applyMode === 'merge' && apiKey) {
              finalCoreFocus = await mergeRulesWithAI(beforeCoreFocus, pointText, apiKey);
            }

            const currentDos = JSON.parse((existingPt.dos as string) || '[]') as string[];
            if (applyMode === 'replace') {
              db.prepare('UPDATE post_types SET core_focus = ?, dos = ? WHERE id = ?')
                .run(finalCoreFocus, JSON.stringify([pointText]), targetRowId);
            } else {
              currentDos.push(pointText);
              db.prepare('UPDATE post_types SET core_focus = ?, dos = ? WHERE id = ?')
                .run(finalCoreFocus, JSON.stringify(currentDos), targetRowId);
            }
          }
        }
        pillarsCount++;
      }
    }

    // Mark dump status as saved
    db.prepare("UPDATE knowledge_dumps SET status = 'saved' WHERE id = ?").run(id);

    // Build human-readable summary
    const summaryParts: string[] = [];
    if (pillarsCount > 0) summaryParts.push(`${pillarsCount} Post Pillar${pillarsCount > 1 ? 's' : ''}`);
    if (anatomyCount > 0) summaryParts.push(`${anatomyCount} Anatomy Section${anatomyCount > 1 ? 's' : ''}`);
    if (mechanicsCount > 0) summaryParts.push(`${mechanicsCount} Writing Mechanic${mechanicsCount > 1 ? 's' : ''}`);
    if (hooksCount > 0) summaryParts.push(`${hooksCount} Hook${hooksCount > 1 ? 's' : ''}`);

    const summaryMessage = summaryParts.length > 0
      ? `Successfully applied ${summaryParts.join(', ')} to your Content OS!`
      : 'Strategy updates confirmed!';

    return NextResponse.json({
      success: true,
      appliedCount: confirmItems.length,
      counts: { pillars: pillarsCount, anatomy: anatomyCount, mechanics: mechanicsCount, hooks: hooksCount },
      summaryMessage
    });
  } catch (e) {
    console.error('knowledge-dumps confirm POST error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
