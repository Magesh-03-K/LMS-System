import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settings';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['FN_START_TIME', 'FN_CUTOFF', 'AN_START_TIME', 'AN_CUTOFF'],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return NextResponse.json({
      success: true,
      fnStart: settingsMap.get('FN_START_TIME') || '08:30',
      fnCutoff: settingsMap.get('FN_CUTOFF') || '09:00',
      anStart: settingsMap.get('AN_START_TIME') || '12:40',
      anCutoff: settingsMap.get('AN_CUTOFF') || '13:10',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch attendance settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();
    const { fnStart, fnCutoff, anStart, anCutoff } = body;

    const updates = [
      { key: 'FN_START_TIME', value: fnStart || '08:30' },
      { key: 'FN_CUTOFF', value: fnCutoff || '09:00' },
      { key: 'AN_START_TIME', value: anStart || '12:40' },
      { key: 'AN_CUTOFF', value: anCutoff || '13:10' },
    ];

    await Promise.all(
      updates.map((u) =>
        prisma.systemSetting.upsert({
          where: { key: u.key },
          update: { value: u.value },
          create: { key: u.key, value: u.value },
        })
      )
    );

    // Invalidate Redis cache so attendance routes immediately pick up new windows
    await invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      message: 'Attendance window settings saved successfully!',
      fnStart: fnStart || '08:30',
      fnCutoff: fnCutoff || '09:00',
      anStart: anStart || '12:40',
      anCutoff: anCutoff || '13:10',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save attendance settings' }, { status: 500 });
  }
}
