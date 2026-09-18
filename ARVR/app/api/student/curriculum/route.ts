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
            trainingCalendar: {
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
        tasks: {
          include: {
            evaluation: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const taskMap = new Map(student.tasks.map((t) => [t.trainingDayId, t]));
    const maxDayNumber = Math.max(...student.batch.trainingCalendar.map((d) => d.dayNumber), 0);

    const days = student.batch.trainingCalendar.map((day) => {
      const submission = taskMap.get(day.id);
      const isFinalExam = day.dayNumber === maxDayNumber ||
        day.taskTitle.toLowerCase().includes('final exam') ||
        day.taskTitle.toLowerCase().includes('examination');

      const tasksList = (day.tasks && Array.isArray(day.tasks) && day.tasks.length > 0)
        ? day.tasks
        : [{ id: `task-${day.dayNumber}-1`, title: day.taskTitle, description: day.taskDescription }];

      const resourcesList = Array.isArray(day.resources) ? day.resources : [];

      return {
        id: day.id,
        dayNumber: day.dayNumber,
        taskTitle: day.taskTitle,
        taskDescription: day.taskDescription,
        tasks: tasksList,
        resources: resourcesList,
        date: day.date,
        isFinalExam,
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              submittedAt: submission.submittedAt,
              screenshotUrl: submission.screenshotUrl,
              evaluation: submission.evaluation
                ? {
                    score: submission.evaluation.score,
                    grade: submission.evaluation.grade,
                    comments: submission.evaluation.comments,
                    trainingLevel: submission.evaluation.trainingLevel,
                  }
                : null,
            }
          : null,
      };
    });

    const resources = [
      {
        id: 'xr-toolkit',
        category: 'VR Core SDK',
        title: 'Unity XR Interaction Toolkit (XRI 3.0)',
        description: 'Complete reference for Ray Interactors, Direct Grab, Teleportation Providers, and XR Origin setup in Unity 6.',
        badge: 'Essential VR',
        link: 'https://docs.unity3d.com/Packages/com.unity.xr.interaction.toolkit@3.0/manual/index.html',
      },
      {
        id: 'meta-quest',
        category: 'Hardware SDK',
        title: 'Meta Quest All-in-One SDK & Passthrough',
        description: 'Building mixed-reality experiences, Passthrough layer configuration, and Hand Tracking 2.0 integration.',
        badge: 'Mixed Reality',
        link: 'https://developer.oculus.com/documentation/unity/unity-gs-overview/',
      },
      {
        id: 'ar-foundation',
        category: 'AR Mobile SDK',
        title: 'Unity AR Foundation (ARKit & ARCore)',
        description: 'Plane detection, Image tracking, World mesh occlusion, and Light estimation setup for iOS and Android.',
        badge: 'Mobile AR',
        link: 'https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@5.1/manual/index.html',
      },
      {
        id: 'vr-performance',
        category: 'Optimization',
        title: 'Spatial Computing Performance & FPS Targets',
        description: 'Maintaining 90 FPS target, Fixed Foveated Rendering (FFR), Single Pass Instanced Rendering, and Draw Call reduction.',
        badge: 'Best Practice',
        link: 'https://developer.oculus.com/documentation/unity/unity-perf/',
      },
    ];

    return NextResponse.json({
      batch: {
        id: student.batch.id,
        name: student.batch.name,
        startDate: student.batch.startDate,
        endDate: student.batch.endDate,
        trainingDays: student.batch.trainingDays,
      },
      days,
      resources,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Curriculum fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch curriculum & resources' }, { status: 500 });
  }
}
