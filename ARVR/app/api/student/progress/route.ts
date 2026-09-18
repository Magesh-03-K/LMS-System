import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth(['STUDENT']);

    const student = await prisma.student.findUnique({
      where: { id: user.id },
      include: {
        batch: {
          include: {
            trainingCalendar: true,
          },
        },
        attendances: true,
        tasks: {
          include: {
            evaluation: true,
            trainingDay: true,
          },
        },
        evaluations: true,
        certificate: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const totalTrainingDays = student.batch.trainingDays || student.batch.trainingCalendar.length || 1;
    const calendarDays = student.batch.trainingCalendar || [];
    const maxPossibleSessions = calendarDays.length > 0
      ? calendarDays.reduce((sum, day) => sum + (day.hasForenoon !== false ? 1 : 0) + (day.hasAfternoon !== false ? 1 : 0), 0)
      : totalTrainingDays * 2;

    const sessionsMarked = student.attendances.length;
    const attendancePct = maxPossibleSessions > 0
      ? Math.min(100, Math.round((sessionsMarked / maxPossibleSessions) * 100))
      : 100;

    const tasksAccepted = student.tasks.filter((t) => t.status === 'ACCEPTED').length;
    const tasksSubmitted = student.tasks.length;
    const taskPct = Math.min(100, Math.round((tasksAccepted / totalTrainingDays) * 100));

    const evaluations = student.evaluations;
    const totalScore = evaluations.reduce((sum, ev) => sum + ev.score, 0);
    const evalAvg = evaluations.length > 0 ? Math.round(totalScore / evaluations.length) : 0;

    // Overall weighted score: 30% attendance, 30% tasks, 40% evaluation average
    const overallPct = Math.round(
      attendancePct * 0.3 + taskPct * 0.3 + evalAvg * 0.4
    );

    // Identify Final Exam day and its evaluation on the last day of the batch
    const sortedDays = [...student.batch.trainingCalendar].sort((a, b) => b.dayNumber - a.dayNumber);
    const finalExamDay = sortedDays[0];
    const finalExamTask = student.tasks.find((t) => t.trainingDayId === finalExamDay?.id);
    const finalExamEval = finalExamTask?.evaluation || student.evaluations.find((e) => e.taskId === finalExamTask?.id);

    const finalExam = {
      dayNumber: finalExamDay?.dayNumber || totalTrainingDays,
      taskTitle: finalExamDay?.taskTitle || 'Final Examination',
      isSubmitted: !!finalExamTask,
      submissionStatus: finalExamTask?.status || 'NOT_SUBMITTED',
      isEvaluated: !!finalExamEval,
      score: finalExamEval?.score ?? null,
      grade: finalExamEval?.grade ?? null,
      trainingLevel: finalExamEval?.trainingLevel ?? null,
      comments: finalExamEval?.comments ?? null,
      evaluatedAt: finalExamEval?.evaluatedAt ?? null,
    };

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        registerNo: student.registerNo,
        email: student.email,
        department: student.department,
        year: student.year,
        section: student.section,
        batchName: student.batch.name,
      },
      metrics: {
        sessionsMarked,
        maxPossibleSessions,
        attendancePct,
        tasksSubmitted,
        tasksAccepted,
        totalTrainingDays,
        taskPct,
        evalCount: evaluations.length,
        evalAvg,
        overallPct,
        finalExamGrade: finalExamEval?.grade || student.certificate?.finalGrade || null,
        finalExamScore: finalExamEval?.score ?? null,
      },
      tasks: student.tasks,
      finalExam,
      certificate: student.certificate,
      calendar: student.batch.trainingCalendar,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Student progress error:', error);
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}
