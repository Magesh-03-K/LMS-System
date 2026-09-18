import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    const tasks = await prisma.taskSubmission.findMany({
      where: batchId ? { student: { batchId } } : {},
      include: {
        student: {
          select: {
            id: true,
            name: true,
            registerNo: true,
            department: true,
            section: true,
            batch: { select: { name: true } },
          },
        },
        trainingDay: true,
        evaluation: true,
      },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch task submissions' }, { status: 500 });
  }
}
