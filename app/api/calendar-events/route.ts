import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // e.g. "2026-09" or undefined for all

    const db = getDb();
    
    let calQuery = `
      SELECT ce.*, pt.name as post_type_name
      FROM calendar_entries ce
      LEFT JOIN post_types pt ON ce.post_type_id = pt.id
    `;
    const calParams: unknown[] = [];
    if (month) {
      calQuery += ` WHERE ce.date LIKE ?`;
      calParams.push(`${month}%`);
    }

    let postsQuery = `
      SELECT p.*, pt.name as post_type_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
    `;
    const postsParams: unknown[] = [];
    if (month) {
      postsQuery += ` WHERE p.date LIKE ?`;
      postsParams.push(`${month}%`);
    }

    const calendarEntries = db.prepare(calQuery).all(...calParams) as Record<string, unknown>[];
    const posts = db.prepare(postsQuery).all(...postsParams) as Record<string, unknown>[];

    const parsedCalendar = calendarEntries.map(ce => ({
      ...ce,
      topics_covered: ce.topics_covered ? JSON.parse(ce.topics_covered as string) : []
    }));

    const parsedPosts = posts.map(p => ({
      ...p,
      versions: p.versions ? JSON.parse(p.versions as string) : []
    }));

    return NextResponse.json({
      calendarEntries: parsedCalendar,
      posts: parsedPosts
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceDate, targetDate } = body;

    if (!sourceDate || !targetDate || sourceDate === targetDate) {
      return NextResponse.json({ error: 'Invalid dates for swap' }, { status: 400 });
    }

    const db = getDb();
    const tempDate = `TEMP_${Date.now()}`;

    db.transaction(() => {
      // Swap calendar_entries
      db.prepare('UPDATE calendar_entries SET date = ? WHERE date = ?').run(tempDate, sourceDate);
      db.prepare('UPDATE calendar_entries SET date = ? WHERE date = ?').run(sourceDate, targetDate);
      db.prepare('UPDATE calendar_entries SET date = ? WHERE date = ?').run(targetDate, tempDate);

      // Swap posts (drafts)
      db.prepare('UPDATE posts SET date = ? WHERE date = ?').run(tempDate, sourceDate);
      db.prepare('UPDATE posts SET date = ? WHERE date = ?').run(sourceDate, targetDate);
      db.prepare('UPDATE posts SET date = ? WHERE date = ?').run(targetDate, tempDate);
    })();

    return NextResponse.json({ success: true, sourceDate, targetDate });
  } catch (e) {
    console.error('calendar-events PUT error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
