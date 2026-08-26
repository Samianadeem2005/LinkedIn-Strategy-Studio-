import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const db = getDb();
    const entry = db.prepare(`
      SELECT ce.*, pt.name as post_type_name
      FROM calendar_entries ce
      LEFT JOIN post_types pt ON ce.post_type_id = pt.id
      WHERE ce.date = ?
      ORDER BY ce.rowid DESC
      LIMIT 1
    `).get(date) as Record<string, unknown> | undefined;
    if (!entry) return NextResponse.json(null);
    return NextResponse.json({
      ...entry,
      topics_covered: entry.topics_covered ? JSON.parse(entry.topics_covered as string) : []
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
