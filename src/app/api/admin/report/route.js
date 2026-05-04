import { NextResponse } from 'next/server';
import { getAdminWeeklyReport, verifyAdminPassword } from '../../../../../lib/data/admin';
import { getCurrentWeekKey } from '../../../../../lib/utils/week';

export async function POST(request) {
  try {
    const body = await request.json();
    verifyAdminPassword(body.password || '');

    const report = await getAdminWeeklyReport(body.weekKey || getCurrentWeekKey());
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Admin report failed' },
      { status: 400 },
    );
  }
}
