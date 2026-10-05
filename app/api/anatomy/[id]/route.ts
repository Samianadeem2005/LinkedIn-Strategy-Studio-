import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!row) return NextResponse.json({ error: 'Anatomy not found.' }, { status: 404 });

    const intents = db.prepare(`
      SELECT ci.id, ci.name, ci.display_name
      FROM anatomy_intents ai
      JOIN content_intents ci ON ai.intent_id = ci.id
      WHERE ai.anatomy_id = ?
    `).all(id) as { id: string; name: string; display_name: string }[];

    let parsedFlow: unknown[] = [];
    if (row.thinking_flow) {
      try {
        const parsed = JSON.parse(row.thinking_flow);
        parsedFlow = Array.isArray(parsed)
          ? parsed.map((step: unknown, index: number) => typeof step === 'string'
            ? { name: `Step ${index + 1}`, instruction: step, purpose: '' }
            : step)
          : [{ name: 'Step 1', instruction: String(row.thinking_flow), purpose: '' }];
      } catch {
        parsedFlow = [{ name: 'Step 1', instruction: String(row.thinking_flow), purpose: '' }];
      }
    }

    return NextResponse.json({
      ...row,
      name: row.name || row.section_name,
      purpose: row.purpose || row.rule_description,
      thinkingFlowList: parsedFlow,
      intent_ids: intents.map(i => i.id),
      intents
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!existing) return NextResponse.json({ error: 'Anatomy not found.' }, { status: 404 });

    const name = (body.name || body.section_name || existing.name || existing.section_name || '').trim();
    const purpose = (body.purpose || body.rule_description || existing.purpose || existing.rule_description || '').trim();
    const writingStyle = (body.writing_style || body.writingStyle || existing.writing_style || '').trim();
    const constraints = body.constraints !== undefined ? (body.constraints?.trim() || null) : existing.constraints;
    const orderIndex = body.order_index !== undefined ? Number(body.order_index) : existing.order_index;
    const postTypeId = body.post_type_id !== undefined ? body.post_type_id : (body.applies_to_post_type_id !== undefined ? body.applies_to_post_type_id : existing.post_type_id);

    let thinkingFlowJson = existing.thinking_flow;
    if (Array.isArray(body.thinking_flow) || Array.isArray(body.thinkingFlow)) {
      thinkingFlowJson = JSON.stringify(body.thinking_flow || body.thinkingFlow);
    } else if (typeof body.thinking_flow === 'string') {
      try {
        JSON.parse(body.thinking_flow);
        thinkingFlowJson = body.thinking_flow;
      } catch {
        thinkingFlowJson = JSON.stringify(body.thinking_flow.split('\n').map((s: string) => s.trim()).filter(Boolean));
      }
    }

    const intentIds: string[] | undefined = Array.isArray(body.intent_ids) ? body.intent_ids : undefined;

    const updateAnatomy = db.prepare(`
      UPDATE post_anatomy
      SET name = ?, section_name = ?, purpose = ?, rule_description = ?, thinking_flow = ?, writing_style = ?, constraints = ?, order_index = ?, post_type_id = ?, applies_to_post_type_id = ?
      WHERE id = ?
    `);

    db.transaction(() => {
      updateAnatomy.run(
        name,
        name,
        purpose,
        purpose,
        thinkingFlowJson,
        writingStyle,
        constraints,
        orderIndex,
        postTypeId,
        postTypeId,
        id
      );

      if (intentIds !== undefined) {
        db.prepare('DELETE FROM anatomy_intents WHERE anatomy_id = ?').run(id);
        const insertMap = db.prepare('INSERT OR IGNORE INTO anatomy_intents (anatomy_id, intent_id) VALUES (?, ?)');
        for (const intentId of intentIds) {
          insertMap.run(id, intentId);
        }
      }
    })();

    const updated = db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id) as Record<string, any>;
    const intents = db.prepare(`
      SELECT ci.id, ci.name, ci.display_name
      FROM anatomy_intents ai
      JOIN content_intents ci ON ai.intent_id = ci.id
      WHERE ai.anatomy_id = ?
    `).all(id) as { id: string; name: string; display_name: string }[];

    return NextResponse.json({
      ...updated,
      intent_ids: intents.map(i => i.id),
      intents
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM anatomy_intents WHERE anatomy_id = ?').run(id);
    db.prepare('DELETE FROM post_anatomy WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
