import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // 1. Fetch all post types
    const postTypes = db.prepare('SELECT id, name FROM post_types ORDER BY name ASC').all() as { id: string; name: string }[];

    // 2. Fetch configured pillar quotas
    const quotaRows = db.prepare('SELECT post_type_id, target_count FROM pillar_quotas').all() as { post_type_id: string; target_count: number }[];
    const quotaMap: Record<string, number> = {};
    quotaRows.forEach(q => { quotaMap[q.post_type_id] = q.target_count; });

    // 3. Calculate current week's date bounds (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split('T')[0];

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const sundayStr = sunday.toISOString().split('T')[0];

    // 4. Fetch saved posts for the current week
    const savedPostsThisWeek = db.prepare(`
      SELECT p.id, p.date, p.post_type_id, pt.name as pillar_name, p.status, p.topic_summary
      FROM posts p
      JOIN post_types pt ON p.post_type_id = pt.id
      WHERE p.date >= ? AND p.date <= ?
    `).all(mondayStr, sundayStr) as { id: string; date: string; post_type_id: string; pillar_name: string; status: string; topic_summary: string }[];

    // Count per post_type_id
    const usedThisWeek: Record<string, number> = {};
    savedPostsThisWeek.forEach(p => {
      usedThisWeek[p.post_type_id] = (usedThisWeek[p.post_type_id] || 0) + 1;
    });

    // Map by date (YYYY-MM-DD) or day_name (Monday, Tuesday, etc.)
    const daySavedMap: Record<string, { pillar_name: string; post_id: string; topic: string }> = {};
    savedPostsThisWeek.forEach(p => {
      const pDate = new Date(p.date + 'T00:00:00');
      const dayName = pDate.toLocaleDateString('en-US', { weekday: 'long' });
      daySavedMap[dayName] = {
        pillar_name: p.pillar_name,
        post_id: p.id,
        topic: p.topic_summary || 'Saved Post'
      };
    });

    const quotas = postTypes.map(pt => ({
      post_type_id: pt.id,
      name: pt.name,
      target_count: quotaMap[pt.id] ?? 1,
      used_this_week: usedThisWeek[pt.id] ?? 0
    }));

    return NextResponse.json({
      quotas,
      daySavedMap,
      mondayStr,
      sundayStr
    });
  } catch (e) {
    console.error('GET /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const quotas: { post_type_id: string; target_count: number }[] = body.quotas || [];

    const upsertStmt = db.prepare(`
      INSERT INTO pillar_quotas (post_type_id, target_count)
      VALUES (?, ?)
      ON CONFLICT(post_type_id) DO UPDATE SET target_count = excluded.target_count
    `);

    db.transaction(() => {
      for (const item of quotas) {
        if (item.post_type_id) {
          upsertStmt.run(item.post_type_id, Math.max(0, Number(item.target_count) || 0));
        }
      }
    })();

    return NextResponse.json({ success: true, message: 'Pillar quotas updated.' });
  } catch (e) {
    console.error('POST /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
