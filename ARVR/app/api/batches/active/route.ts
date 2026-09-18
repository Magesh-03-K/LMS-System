import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let batches = await prisma.batch.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: { id: true, name: true, startDate: true, endDate: true, status: true },
      orderBy: { startDate: 'desc' },
    });

    // Fallback if no active batches are found: return all batches
    if (batches.length === 0) {
      batches = await prisma.batch.findMany({
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: 'desc' },
      });
    }

    return NextResponse.json({ batches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch active batches' }, { status: 500 });
  }
}
