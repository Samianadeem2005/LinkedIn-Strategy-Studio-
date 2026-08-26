import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const existing = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

    const updates: string[] = [];
    const vals: unknown[] = [];
    if (body.status !== undefined) {
      updates.push('status = ?');
      vals.push(body.status);
      if (body.status === 'published') {
        updates.push('published_at = ?');
        vals.push(new Date().toISOString());
      }
    }
    if (body.selected_version !== undefined) { updates.push('selected_version = ?'); vals.push(body.selected_version); }
    if (body.versions !== undefined) { updates.push('versions = ?'); vals.push(JSON.stringify(body.versions)); }
    if (body.topic_summary !== undefined) { updates.push('topic_summary = ?'); vals.push(body.topic_summary); }
    if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

    vals.push(id);
    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({ ...row, versions: JSON.parse(row.versions as string ?? '[]') });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare(`
      SELECT p.*, pt.name as post_type_name
      FROM posts p LEFT JOIN post_types pt ON p.post_type_id = pt.id
      WHERE p.id = ?
    `).get(id) as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    return NextResponse.json({ ...row, versions: JSON.parse(row.versions as string ?? '[]') });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
