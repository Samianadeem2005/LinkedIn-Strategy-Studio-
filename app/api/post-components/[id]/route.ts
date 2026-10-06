import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const UNIVERSAL_COMPONENTS = ['Hook', 'Context', 'Body', 'CTA', 'Visual Suggestion'];
const componentTypeFor = (name: string) => name.toLowerCase().replace(/\s+/g, '_');
const isUniversalComponent = (name: string) => UNIVERSAL_COMPONENTS.includes(name.trim());

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const existing = db.prepare('SELECT * FROM post_components WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: 'Post component not found.' }, { status: 404 });
    const nextName = body.name === undefined ? String(existing.name) : String(body.name).trim();
    if (!isUniversalComponent(nextName)) {
      return NextResponse.json({ error: `Component name must be one of: ${UNIVERSAL_COMPONENTS.join(', ')}.` }, { status: 400 });
    }
    db.prepare(`
      UPDATE post_components
      SET name = ?, description = ?, component_type = ?, purpose = ?,
          instructions = ?, order_index = ?, enabled = ?
      WHERE id = ?
    `).run(
      nextName,
      body.description === undefined ? existing.description : (body.description?.trim() || null),
      componentTypeFor(nextName),
      body.purpose === undefined ? existing.purpose : (body.purpose?.trim() || null),
      body.instructions === undefined ? existing.instructions : String(body.instructions).trim(),
      UNIVERSAL_COMPONENTS.indexOf(nextName),
      body.enabled === undefined ? existing.enabled : (body.enabled ? 1 : 0),
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
