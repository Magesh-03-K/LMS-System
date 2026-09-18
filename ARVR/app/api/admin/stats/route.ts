import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStudents, totalBatches, activeBatches, totalAttendances, totalTasks, completedCertificates] =
      await Promise.all([
        prisma.student.count(),
        prisma.batch.count(),
        prisma.batch.count({ where: { status: 'ACTIVE', endDate: { gte: today } } }),
        prisma.attendance.count(),
        prisma.taskSubmission.count(),
        prisma.certificateRecord.count(),
      ]);

    const acceptedTasks = await prisma.taskSubmission.count({
      where: { status: 'ACCEPTED' },
    });

    return NextResponse.json({
      stats: {
        totalStudents,
        totalBatches,
        activeBatches,
        totalAttendances,
        totalTasks,
        acceptedTasks,
        completedCertificates,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
