import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth(['ADMIN']);

    const batches = await prisma.batch.findMany({
      include: {
        students: true,
        trainingCalendar: {
          orderBy: { dayNumber: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ batches });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch trainer batches' }, { status: 500 });
  }
}
