import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT wm.*, pt.name as post_type_name
      FROM weekly_mapping wm
      LEFT JOIN post_types pt ON wm.post_type_id = pt.id
      ORDER BY CASE wm.day_of_week
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7 END
    `).all();
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body = array of { day_of_week, post_type_id, series_length, is_continuation_of }
    const entries = Array.isArray(body) ? body : [body];
    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO weekly_mapping (day_of_week, post_type_id, series_length, is_continuation_of)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(day_of_week) DO UPDATE SET
        post_type_id = excluded.post_type_id,
        series_length = excluded.series_length,
        is_continuation_of = excluded.is_continuation_of
    `);
    const tx = db.transaction((items: { day_of_week: string; post_type_id: string | null; series_length: number; is_continuation_of: string | null }[]) => {
      for (const item of items) upsert.run(item.day_of_week, item.post_type_id ?? null, item.series_length ?? 1, item.is_continuation_of ?? null);
    });
    tx(entries);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
