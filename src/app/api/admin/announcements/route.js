import { NextResponse } from 'next/server';
import { createAnnouncement, verifyAdminPassword } from '../../../../../lib/data/admin';

export async function POST(request) {
  try {
    const body = await request.json();
    verifyAdminPassword(body.password || '');

    const announcement = await createAnnouncement(body.date, body.title, body.body);
    return NextResponse.json({ ok: true, announcement });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Announcement creation failed' },
      { status: 400 },
    );
  }
}
