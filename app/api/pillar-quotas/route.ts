import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface CustomPillarRuleRow {
  id: string;
  name: string;
  pillar_ids: string;
  target_count: number;
  created_at: string;
}

export async function GET() {
  try {
    const db = getDb();

    // 1. Fetch base post types
    const basePostTypes = db.prepare('SELECT id, name FROM post_types ORDER BY name ASC').all() as { id: string; name: string }[];
    const basePostTypeMap: Record<string, string> = {};
    basePostTypes.forEach(pt => { basePostTypeMap[pt.id] = pt.name; });

    // 2. Fetch custom pillar rules
    const rulesRows = db.prepare('SELECT * FROM custom_pillar_rules ORDER BY created_at ASC, name ASC').all() as CustomPillarRuleRow[];

    // 3. Calculate current week's date bounds (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
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
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      WHERE p.date >= ? AND p.date <= ?
    `).all(mondayStr, sundayStr) as { id: string; date: string; post_type_id: string; pillar_name: string; status: string; topic_summary: string }[];

    // Map rules with parsed pillar_ids & used_this_week count
    const rules = rulesRows.map(r => {
      let pillarIds: string[] = [];
      try { pillarIds = JSON.parse(r.pillar_ids); } catch { pillarIds = []; }

      // Count posts saved this week matching either this rule's id or any of its constituent pillar_ids
      const usedThisWeek = savedPostsThisWeek.filter(p => p.post_type_id === r.id || pillarIds.includes(p.post_type_id)).length;
      const pillarNames = pillarIds.map(pid => basePostTypeMap[pid] || 'Pillar').filter(Boolean);

      return {
        id: r.id,
        name: r.name,
        pillar_ids: pillarIds,
        pillar_names: pillarNames,
        target_count: r.target_count ?? 1,
        used_this_week: usedThisWeek,
        is_hybrid: pillarIds.length > 1
      };
    });

    // Map day saved
    const daySavedMap: Record<string, { pillar_name: string; post_id: string; topic: string }> = {};
    savedPostsThisWeek.forEach(p => {
      const pDate = new Date(p.date + 'T00:00:00');
      const dayName = pDate.toLocaleDateString('en-US', { weekday: 'long' });
      daySavedMap[dayName] = {
        pillar_name: p.pillar_name || 'Draft Post',
        post_id: p.id,
        topic: p.topic_summary || 'Saved Post'
      };
    });

    return NextResponse.json({
      rules,
      basePostTypes,
      daySavedMap,
      mondayStr,
      sundayStr
    });
  } catch (e) {
    console.error('GET /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create a new custom or hybrid pillar rule
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const { name, pillar_ids, target_count } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Rule name is required.' }, { status: 400 });
    if (!Array.isArray(pillar_ids) || pillar_ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one content pillar.' }, { status: 400 });
    }

    const id = uuidv4();
    const count = Math.max(0, Number(target_count) || 1);

    db.prepare(`
      INSERT INTO custom_pillar_rules (id, name, pillar_ids, target_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name.trim(), JSON.stringify(pillar_ids), count, new Date().toISOString());

    return NextResponse.json({ success: true, id, message: 'Pillar rule created successfully.' });
  } catch (e) {
    console.error('POST /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT: Bulk update weekly target counts for rules
export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const rules: { id: string; target_count: number }[] = body.rules || [];

    const updateStmt = db.prepare(`
      UPDATE custom_pillar_rules SET target_count = ? WHERE id = ?
    `);

    db.transaction(() => {
      for (const item of rules) {
        if (item.id) {
          updateStmt.run(Math.max(0, Number(item.target_count) || 0), item.id);
        }
      }
    })();

    return NextResponse.json({ success: true, message: 'Weekly target quotas saved.' });
  } catch (e) {
    console.error('PUT /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: Delete a custom rule
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Rule ID is required.' }, { status: 400 });

    const db = getDb();
    db.prepare('DELETE FROM custom_pillar_rules WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Pillar rule deleted.' });
  } catch (e) {
    console.error('DELETE /api/pillar-quotas error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
