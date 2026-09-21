import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getTodayDateString, isAttendanceMatchingDate, DEFAULT_TIMEZONE } from '@/lib/time';
import { generatePresignedUploadUrl, validateFileMetadata } from '@/lib/s3';
import { getCachedSystemSettings } from '@/lib/settings';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(['STUDENT']);
    const body = await request.json();
    const { trainingDayId, filename, fileSize, mimeType } = body;

    if (!trainingDayId || !filename || fileSize === undefined || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required upload fields: trainingDayId, filename, fileSize, and mimeType are required.' },
        { status: 400 }
      );
    }

    // 1. Validate file metadata upfront
    const validation = validateFileMetadata(filename, mimeType, Number(fileSize));
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 2. Fetch authenticated student & batch
    const student = await prisma.student.findUnique({
      where: { id: user.id },
      include: { batch: true },
    });

    if (!student || !student.batch) {
      return NextResponse.json({ error: 'Student or batch record not found' }, { status: 404 });
    }

    // 3. Fetch TrainingDay details
    const trainingDay = await prisma.trainingDay.findUnique({
      where: { id: trainingDayId },
    });

    if (!trainingDay || trainingDay.batchId !== student.batchId) {
      return NextResponse.json({ error: 'Invalid training day or unauthorized batch' }, { status: 400 });
    }

    // 4. Server-side Gate: Require attendance for today, or for the training day, or existing submission
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        studentId_trainingDayId: {
          studentId: student.id,
          trainingDayId: trainingDay.id,
        },
      },
    });

    const settingsMap = await getCachedSystemSettings();
    const timezone = settingsMap.get('PROGRAM_TIMEZONE') || DEFAULT_TIMEZONE;
    const todayStr = getTodayDateString(new Date(), timezone);
    const dayDateStr = getTodayDateString(new Date(trainingDay.date), timezone);

    const attendances = await prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: 'desc' },
    });

    const hasTodayAtt = attendances.some((a) => isAttendanceMatchingDate(a, todayStr, timezone));
    const hasDayAtt = attendances.some((a) => isAttendanceMatchingDate(a, dayDateStr, timezone));

    if (!hasTodayAtt && !hasDayAtt && !existingSubmission) {
      return NextResponse.json(
        {
          error: 'Task submission is locked. You must mark attendance for today before requesting an upload URL.',
        },
        { status: 403 }
      );
    }

    // 5. Generate secure S3 presigned PUT URL
    const presigned = await generatePresignedUploadUrl({
      batchId: student.batch.id,
      trainingDayId: trainingDay.id,
      studentId: student.id,
      registerNo: student.registerNo,
      dayNumber: trainingDay.dayNumber,
      originalFilename: filename,
      mimeType: validation.normalizedMime!,
      fileSize: Number(fileSize),
      expiresInSeconds: 900,
    });

    return NextResponse.json({
      success: true,
      uploadUrl: presigned.uploadUrl,
      s3Key: presigned.s3Key,
      storedFilename: presigned.storedFilename,
      expiresIn: presigned.expiresIn,
      bucket: presigned.bucket,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Presigned upload URL generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate presigned upload URL' }, { status: 500 });
  }
}
