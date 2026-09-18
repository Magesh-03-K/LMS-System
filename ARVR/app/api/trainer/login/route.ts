import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userLoginSchema } from '@/lib/validation';
import { comparePinOrPassword, getSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rateLimit';

export async function POST() {
  return NextResponse.json({ error: 'Trainer login is deprecated. Please sign in as Admin.' }, { status: 400 });
}
