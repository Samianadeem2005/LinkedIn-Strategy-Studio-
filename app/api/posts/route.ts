import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postTypeId = searchParams.get('post_type_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const db = getDb();
    let query = `
      SELECT p.*, pt.name as post_type_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (postTypeId) { query += ' AND p.post_type_id = ?'; params.push(postTypeId); }
    if (status) { query += ' AND p.status = ?'; params.push(status); }
    query += ' ORDER BY p.date DESC, p.created_at DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    return NextResponse.json(rows.map(r => ({
      ...r,
      versions: r.versions ? JSON.parse(r.versions as string) : []
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const postTypeId = body.post_type_id && String(body.post_type_id).trim() !== '' ? body.post_type_id : null;

    db.prepare(`
      INSERT INTO posts (id, calendar_entry_id, date, post_type_id, series_part, raw_notes_used, topic_summary, versions, selected_version, status, post_format, character_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.calendar_entry_id ?? null, body.date || new Date().toISOString().split('T')[0], postTypeId,
      body.series_part ?? null, body.raw_notes_used ?? null, body.topic_summary ?? null,
      JSON.stringify(body.versions ?? []), body.selected_version ?? 0,
      body.status ?? 'draft', body.post_format ?? 'text_post', body.character_count ?? 0, new Date().toISOString()
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
