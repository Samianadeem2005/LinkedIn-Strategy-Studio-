import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postTypeId = searchParams.get('post_type_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') ?? '100');
    const db = getDb();
    let query = `
      SELECT p.id, p.date, p.post_type_id, pt.name as post_type_name,
             p.topic_summary, p.status, p.selected_version, p.created_at, p.published_at,
             p.series_part, p.calendar_entry_id,
             p.versions
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
