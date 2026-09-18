import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hashPinOrPassword } from '@/lib/auth';
import { z } from 'zod';

const createTrainerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function GET() {
  try {
    await requireAuth(['ADMIN']);
    return NextResponse.json({ trainers: [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch trainers' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Trainer role is deprecated. System uses Admin role only.' }, { status: 400 });
}
