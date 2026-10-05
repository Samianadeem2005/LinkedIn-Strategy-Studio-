import { NextRequest, NextResponse } from 'next/server';
import { getDb, getEligibleAnatomiesForIntent } from '@/lib/db';
import { resolveContentIntent } from '@/lib/intentResolver';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawNotes, postTypeId, explicitIntentId } = body;

    if (!postTypeId) {
      return NextResponse.json({ error: 'postTypeId is required.' }, { status: 400 });
    }

    const db = getDb();
    const pt = db.prepare('SELECT id, name FROM post_types WHERE id = ?').get(postTypeId) as { id: string; name: string } | undefined;
    if (!pt) {
      return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });
    }

    const resolution = resolveContentIntent(rawNotes || '', pt.id, pt.name, explicitIntentId);
    const eligibleAnatomies = getEligibleAnatomiesForIntent(pt.id, resolution.intentId);
    const selectedAnatomy = eligibleAnatomies[0] || null;

    return NextResponse.json({
      resolution,
      eligibleAnatomies,
      selectedAnatomy,
      totalEligible: eligibleAnatomies.length
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
