import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { feedbackSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(['STUDENT']);
    const body = await request.json();

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid feedback' }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        studentId: user.id,
        message: parsed.data.message,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully! Thank you for your response.',
      feedback,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Feedback submit error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
