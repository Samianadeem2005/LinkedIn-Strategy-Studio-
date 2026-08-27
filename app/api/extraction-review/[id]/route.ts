import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { point_text, user_decision, apply_mode } = body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM extraction_review WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Review item not found.' }, { status: 404 });
    }

    let query = 'UPDATE extraction_review SET ';
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof point_text === 'string') {
      updates.push('point_text = ?');
      values.push(point_text);
    }
    if (typeof user_decision === 'string') {
      if (!['keep', 'discard', 'pending', 'apply_update', 'keep_previous'].includes(user_decision)) {
        return NextResponse.json({ error: 'Invalid user_decision.' }, { status: 400 });
      }
      updates.push('user_decision = ?');
      values.push(user_decision);
    }
    if (typeof apply_mode === 'string') {
      if (!['merge', 'replace'].includes(apply_mode)) {
        return NextResponse.json({ error: 'Invalid apply_mode.' }, { status: 400 });
      }
      updates.push('apply_mode = ?');
      values.push(apply_mode);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    query += updates.join(', ') + ' WHERE id = ?';
    values.push(id);

    db.prepare(query).run(...values);

    const updated = db.prepare('SELECT * FROM extraction_review WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (e) {
    console.error('extraction-review PUT error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
