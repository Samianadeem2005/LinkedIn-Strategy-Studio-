import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Suggest Pillar classification endpoint has been removed.' }, { status: 410 });
}
