import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const BLOCKED_ANATOMY_COMPONENTS = new Set(['rehook', 'pivot', 'breakdown', 'lesson', 'nudge']);
const componentTypeFor = (name: string) => name.toLowerCase().replace(/\s+/g, '_');
const isBlockedAnatomyComponent = (name: string) => BLOCKED_ANATOMY_COMPONENTS.has(name.trim().toLowerCase());

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const existing = db.prepare('SELECT * FROM post_components WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: 'Post component not found.' }, { status: 404 });
    const nextName = body.name === undefined ? String(existing.name) : String(body.name).trim();
    if (isBlockedAnatomyComponent(nextName)) {
      return NextResponse.json({ error: 'This name is reserved for Anatomy thinking journeys and cannot be used as a Post Component.' }, { status: 400 });
    }
    db.prepare(`
      UPDATE post_components
      SET name = ?, description = ?, component_type = ?, purpose = ?, instructions = ?,
          order_index = ?, enabled = ?, post_type_id = ?
      WHERE id = ?
    `).run(
      nextName,
      body.description === undefined ? existing.description : (body.description?.trim() || null),
      componentTypeFor(nextName),
      body.purpose === undefined ? existing.purpose : (body.purpose?.trim() || null),
      body.instructions === undefined ? existing.instructions : String(body.instructions).trim(),
      body.order_index === undefined ? existing.order_index : Number(body.order_index),
      body.enabled === undefined ? existing.enabled : (body.enabled ? 1 : 0),
      body.post_type_id === undefined ? existing.post_type_id : (body.post_type_id || null),
      id
    );
    return NextResponse.json(db.prepare('SELECT * FROM post_components WHERE id = ?').get(id));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM post_components WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
