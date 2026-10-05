import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare(`
      SELECT ci.*, pt.name as post_type_name
      FROM content_intents ci
      LEFT JOIN post_types pt ON ci.post_type_id = pt.id
      WHERE ci.id = ?
    `).get(id);

    if (!row) {
      return NextResponse.json({ error: 'Content intent not found.' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM content_intents WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Content intent not found.' }, { status: 404 });
    }

    const name = body.name !== undefined ? body.name.trim().toLowerCase().replace(/\s+/g, '_') : existing.name;
    const displayName = body.display_name !== undefined ? body.display_name.trim() : existing.display_name;
    const description = body.description !== undefined ? body.description.trim() : existing.description;
    const postTypeId = body.post_type_id !== undefined ? body.post_type_id : existing.post_type_id;
    const priority = body.priority !== undefined ? Number(body.priority) : existing.priority;
    const isDefault = body.is_default !== undefined ? (body.is_default ? 1 : 0) : existing.is_default;
    const now = new Date().toISOString();

    if (isDefault && postTypeId) {
      db.prepare('UPDATE content_intents SET is_default = 0 WHERE post_type_id = ? AND id != ?').run(postTypeId, id);
    }

    db.prepare(`
      UPDATE content_intents
      SET name = ?, display_name = ?, description = ?, post_type_id = ?, priority = ?, is_default = ?, updated_at = ?
      WHERE id = ?
    `).run(name, displayName, description, postTypeId, priority, isDefault, now, id);

    const updated = db.prepare(`
      SELECT ci.*, pt.name as post_type_name
      FROM content_intents ci
      LEFT JOIN post_types pt ON ci.post_type_id = pt.id
      WHERE ci.id = ?
    `).get(id);

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM anatomy_intents WHERE intent_id = ?').run(id);
    const info = db.prepare('DELETE FROM content_intents WHERE id = ?').run(id);
    return NextResponse.json({ success: true, deletedCount: info.changes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
