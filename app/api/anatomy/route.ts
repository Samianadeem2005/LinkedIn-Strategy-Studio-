import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postTypeId = searchParams.get('post_type_id');
    const intentId = searchParams.get('intent_id');
    const db = getDb();

    let query = `
      SELECT pa.*, pt.name as post_type_name
      FROM post_anatomy pa
      LEFT JOIN post_types pt ON (pa.post_type_id = pt.id OR pa.applies_to_post_type_id = pt.id)
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (intentId) {
      query += ` AND pa.id IN (SELECT anatomy_id FROM anatomy_intents WHERE intent_id = ?)`;
      params.push(intentId);
    }

    if (postTypeId) {
      query += ` AND (pa.post_type_id = ? OR pa.applies_to_post_type_id = ?)`;
      params.push(postTypeId, postTypeId);
    }

    query += ` ORDER BY pa.order_index ASC, pa.rowid ASC`;
    const rows = db.prepare(query).all(...params) as Record<string, any>[];

    // Fetch intent mappings for each anatomy
    const mappingStmt = db.prepare(`
      SELECT ci.id, ci.name, ci.display_name
      FROM anatomy_intents ai
      JOIN content_intents ci ON ai.intent_id = ci.id
      WHERE ai.anatomy_id = ?
    `);

    const result = rows.map(row => {
      const intents = mappingStmt.all(row.id) as { id: string; name: string; display_name: string }[];
      let parsedFlow: string[] = [];
      if (row.thinking_flow) {
        try {
          const parsed = JSON.parse(row.thinking_flow);
          parsedFlow = Array.isArray(parsed) ? parsed : [String(row.thinking_flow)];
        } catch {
          parsedFlow = [String(row.thinking_flow)];
        }
      }

      return {
        ...row,
        name: row.name || row.section_name,
        section_name: row.section_name || row.name,
        rule_description: row.rule_description || row.purpose,
        purpose: row.purpose || row.rule_description,
        thinking_flow: row.thinking_flow,
        thinkingFlowList: parsedFlow,
        post_type_id: row.post_type_id || row.applies_to_post_type_id,
        applies_to_post_type_id: row.applies_to_post_type_id || row.post_type_id,
        intent_ids: intents.map(i => i.id),
        intents
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name || body.section_name || '').trim();
    const purpose = (body.purpose || body.rule_description || '').trim();
    const writingStyle = (body.writing_style || body.writingStyle || '').trim();
    const postTypeId = body.post_type_id || body.applies_to_post_type_id || null;
    const intentIds: string[] = Array.isArray(body.intent_ids) ? body.intent_ids : [];

    if (!name) {
      return NextResponse.json({ error: 'Anatomy name is required.' }, { status: 400 });
    }
    if (!purpose) {
      return NextResponse.json({ error: 'Purpose / Rule description is required.' }, { status: 400 });
    }

    let thinkingFlowJson = '[]';
    if (Array.isArray(body.thinking_flow) || Array.isArray(body.thinkingFlow)) {
      thinkingFlowJson = JSON.stringify(body.thinking_flow || body.thinkingFlow);
    } else if (typeof body.thinking_flow === 'string' && body.thinking_flow.trim()) {
      try {
        JSON.parse(body.thinking_flow);
        thinkingFlowJson = body.thinking_flow;
      } catch {
        thinkingFlowJson = JSON.stringify(body.thinking_flow.split('\n').map((s: string) => s.trim()).filter(Boolean));
      }
    }

    const db = getDb();
    const maxOrder = (db.prepare('SELECT MAX(order_index) as m FROM post_anatomy').get() as { m: number | null }).m ?? -1;
    const id = uuidv4();

    const insertAnatomy = db.prepare(`
      INSERT INTO post_anatomy (
        id, name, section_name, rule_description, purpose, thinking_flow, writing_style, constraints, order_index, post_type_id, applies_to_post_type_id, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    const insertMapping = db.prepare(`
      INSERT OR IGNORE INTO anatomy_intents (anatomy_id, intent_id) VALUES (?, ?)
    `);

    db.transaction(() => {
      insertAnatomy.run(
        id,
        name,
        name,
        purpose,
        purpose,
        thinkingFlowJson,
        writingStyle || 'Paragraph-led natural prose.',
        body.constraints?.trim() || null,
        body.order_index ?? maxOrder + 1,
        postTypeId,
        postTypeId
      );

      for (const intentId of intentIds) {
        insertMapping.run(id, intentId);
      }
    })();

    const created = db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id) as Record<string, any>;
    const intents = db.prepare(`
      SELECT ci.id, ci.name, ci.display_name
      FROM anatomy_intents ai
      JOIN content_intents ci ON ai.intent_id = ci.id
      WHERE ai.anatomy_id = ?
    `).all(id) as { id: string; name: string; display_name: string }[];

    return NextResponse.json({
      ...created,
      intent_ids: intents.map(i => i.id),
      intents
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // Bulk reorder: body = array of { id, order_index }
    if (Array.isArray(body)) {
      const db = getDb();
      const update = db.prepare('UPDATE post_anatomy SET order_index = ? WHERE id = ?');
      const tx = db.transaction((items: { id: string; order_index: number }[]) => {
        for (const item of items) update.run(item.order_index, item.id);
      });
      tx(body);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Expected array for bulk reorder.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
