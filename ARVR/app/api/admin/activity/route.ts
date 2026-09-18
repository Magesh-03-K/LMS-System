import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    const [submissions, evaluations, attendances, students, batches, driveConns] = await Promise.all([
      prisma.taskSubmission.findMany({
        take: 6,
        orderBy: { submittedAt: 'desc' },
        include: {
          student: true,
          trainingDay: true,
        },
      }),
      prisma.evaluation.findMany({
        take: 6,
        orderBy: { evaluatedAt: 'desc' },
        include: {
          student: true,
          task: { include: { trainingDay: true } },
        },
      }),
      prisma.attendance.findMany({
        take: 6,
        orderBy: { markedAt: 'desc' },
        include: {
          student: true,
        },
      }),
      prisma.student.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { batch: true },
      }),
      prisma.batch.findMany({
        take: 4,
        orderBy: { startDate: 'desc' },
      }),
      prisma.googleDriveConnection.findMany({
        take: 2,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const activities: Array<{
      id: string;
      type: 'SUBMISSION' | 'EVALUATION' | 'ATTENDANCE' | 'STUDENT_REGISTER' | 'BATCH_CREATE' | 'DRIVE_CONNECT';
      title: string;
      subtitle: string;
      timestamp: Date;
    }> = [];

    // Format Submissions
    submissions.forEach((s) => {
      activities.push({
        id: `sub-${s.id}`,
        type: 'SUBMISSION',
        title: `Task submitted by ${s.student.name}`,
        subtitle: `${s.student.registerNo} • Day ${s.trainingDay.dayNumber} (${s.storedFilename || s.originalFilename || 'File Uploaded'})`,
        timestamp: s.submittedAt,
      });
    });

    // Format Evaluations
    evaluations.forEach((e) => {
      const gradeFormatted = (e.grade || 'A').replace('_PLUS', '+').replace('_MINUS', '-');
      activities.push({
        id: `eval-${e.id}`,
        type: 'EVALUATION',
        title: `Task evaluated for ${e.student.name}`,
        subtitle: `Score: ${e.score}/100 • Grade: ${gradeFormatted} • Day ${e.task?.trainingDay?.dayNumber || ''}`,
        timestamp: e.evaluatedAt,
      });
    });

    // Format Attendance
    attendances.forEach((a) => {
      activities.push({
        id: `att-${a.id}`,
        type: 'ATTENDANCE',
        title: `Attendance marked: ${a.student.name}`,
        subtitle: `${a.student.registerNo} • ${a.session} Session (${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        timestamp: a.markedAt,
      });
    });

    // Format Student Registrations
    students.forEach((st) => {
      activities.push({
        id: `st-${st.id}`,
        type: 'STUDENT_REGISTER',
        title: `New student registered: ${st.name}`,
        subtitle: `${st.registerNo} • ${st.department} (${st.batch?.name || 'Batch'})`,
        timestamp: st.createdAt,
      });
    });

    // Format Batches
    batches.forEach((b) => {
      activities.push({
        id: `b-${b.id}`,
        type: 'BATCH_CREATE',
        title: `Training batch active: ${b.name}`,
        subtitle: `${b.trainingDays} Days • ${b.level || 'Level 1'}`,
        timestamp: b.startDate,
      });
    });

    // Format Google Drive Connections
    driveConns.forEach((d) => {
      if (d.status === 'CONNECTED') {
        activities.push({
          id: `dc-${d.id}`,
          type: 'DRIVE_CONNECT',
          title: `Google Drive Connected`,
          subtitle: `Account: ${d.googleAccountEmail}`,
          timestamp: d.updatedAt,
        });
      }
    });

    // Sort all activities by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Return top 8 most recent system activities
    const recentActivities = activities.slice(0, 8);

    return NextResponse.json({
      success: true,
      activities: recentActivities,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Fetch system activity error:', error);
    return NextResponse.json({ error: 'Failed to fetch recent activity' }, { status: 500 });
  }
}
