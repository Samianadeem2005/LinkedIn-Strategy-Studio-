import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM hook_types ORDER BY rowid ASC').all() as Record<string, unknown>[];
    const hookTypes = rows.map(r => ({
      ...r,
      angles: r.angles ? JSON.parse(r.angles as string) : [],
      best_fit_pillars: r.best_fit_pillars ? JSON.parse(r.best_fit_pillars as string) : []
    }));
    return NextResponse.json(hookTypes);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, message: 'Legacy hooks endpoint updated' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
