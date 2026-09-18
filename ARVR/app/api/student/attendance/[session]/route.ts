import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getMidnightDate, getDetailedSessionStatus } from '@/lib/time';
import { getCachedSystemSettings } from '@/lib/settings';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ session: string }> }
) {
  try {
    const { session } = await params;
    const user = await requireAuth(['STUDENT']);
    const sessionParam = session.toUpperCase();

    if (sessionParam !== 'FN' && sessionParam !== 'AN') {
      return NextResponse.json({ error: 'Invalid attendance session. Must be FN or AN.' }, { status: 400 });
    }

    // Fetch system cutoff and window settings (Redis-cached with 60s TTL)
    const settingsMap = await getCachedSystemSettings();

    const timezone = settingsMap.get('PROGRAM_TIMEZONE') || process.env.PROGRAM_TIMEZONE || 'Asia/Kolkata';
    const fnStart = settingsMap.get('FN_START_TIME') || '08:45';
    const fnCutoff = settingsMap.get('FN_CUTOFF') || '09:15';
    const anStart = settingsMap.get('AN_START_TIME') || '13:00';
    const anCutoff = settingsMap.get('AN_CUTOFF') || '13:30';

    const startTime = sessionParam === 'FN' ? fnStart : anStart;
    const cutoffTime = sessionParam === 'FN' ? fnCutoff : anCutoff;
    const now = new Date();

    // Default to true (enforced) unless explicitly disabled by admin
    const enforceSetting = settingsMap.get('ENFORCE_ATTENDANCE_WINDOWS');
    const enforceWindows = enforceSetting !== 'false';

    const todayDate = getMidnightDate(now, timezone);

    // 1. Verify if this session is active for the student's batch today
    const student = await prisma.student.findUnique({
      where: { id: user.id },
      include: {
        batch: {
          include: {
            trainingCalendar: true,
          },
        },
      },
    });

    if (student?.batch?.trainingCalendar) {
      const todayStr = todayDate.toISOString().split('T')[0];
      const todayCalendarDay = student.batch.trainingCalendar.find((d) => {
        const dStr = new Date(d.date).toISOString().split('T')[0];
        return dStr === todayStr;
      });

      if (todayCalendarDay) {
        if (sessionParam === 'FN' && todayCalendarDay.hasForenoon === false) {
          return NextResponse.json(
            {
              error: 'No Forenoon (FN) class scheduled for today in your batch. Attendance is not conducted.',
              session: 'FN',
              status: 'NO_CLASS_SCHEDULED',
            },
            { status: 403 }
          );
        }
        if (sessionParam === 'AN' && todayCalendarDay.hasAfternoon === false) {
          return NextResponse.json(
            {
              error: 'No Afternoon (AN) class scheduled for today in your batch. Attendance is not conducted.',
              session: 'AN',
              status: 'NO_CLASS_SCHEDULED',
            },
            { status: 403 }
          );
        }
      }
    }

    // 2. Check if already marked for today
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_date_session: {
          studentId: user.id,
          date: todayDate,
          session: sessionParam,
        },
      },
    });

    if (existing) {
      const status = getDetailedSessionStatus(sessionParam as 'FN' | 'AN', startTime, cutoffTime, now, timezone, true, existing.markedAt);
      return NextResponse.json(
        {
          error: `You have already marked ${status.sessionLabel} attendance for today.`,
          note: status.note,
          status: 'ALREADY_MARKED',
          session: sessionParam,
          markedAt: existing.markedAt,
          startTime: status.startFormatted,
          cutoffTime: status.cutoffFormatted,
        },
        { status: 409 }
      );
    }

    // 2. Server-authoritative cutoff & window verification
    const status = getDetailedSessionStatus(sessionParam as 'FN' | 'AN', startTime, cutoffTime, now, timezone, false);

    if (enforceWindows && !status.canMark) {
      return NextResponse.json(
        {
          error: status.status === 'BEFORE_WINDOW'
            ? `Attendance window for ${status.sessionLabel} has not started yet.`
            : `Attendance cutoff has passed for ${status.sessionLabel}.`,
          note: status.note,
          status: status.status,
          session: sessionParam,
          startTime: status.startFormatted,
          cutoffTime: status.cutoffFormatted,
          currentHHMM: status.currentHHMM,
          currentZonedTime: status.currentZonedFormatted,
        },
        { status: 403 }
      );
    }

    // 3. Record attendance in database
    try {
      const attendance = await prisma.attendance.create({
        data: {
          studentId: user.id,
          date: todayDate,
          session: sessionParam,
          markedAt: now,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${status.sessionLabel} Attendance marked successfully!`,
        note: `✓ Criteria Verified: Marked at ${status.currentZonedFormatted} within the active window (${status.startFormatted} - ${status.cutoffFormatted}).`,
        status: 'MARKED',
        session: sessionParam,
        attendance,
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        return NextResponse.json(
          {
            error: `You have already marked ${sessionParam} attendance for today.`,
            note: `Attendance for today was already recorded in database constraint.`,
            status: 'ALREADY_MARKED',
          },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Attendance marking error:', error);
    return NextResponse.json({ error: error.message || 'Failed to mark attendance' }, { status: 500 });
  }
}
