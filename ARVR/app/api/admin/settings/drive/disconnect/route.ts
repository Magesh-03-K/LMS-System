import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    await requireAuth(['ADMIN']);

    // Delete existing connection records to completely wipe stale refresh tokens
    await prisma.googleDriveConnection.deleteMany();

    return NextResponse.json({
      success: true,
      message: 'Google Drive account disconnected successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to disconnect Google Drive.' }, { status: 500 });
  }
}
