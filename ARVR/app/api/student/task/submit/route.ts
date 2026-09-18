import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getMidnightDate, DEFAULT_TIMEZONE } from '@/lib/time';
import {
  getBucketName,
  getS3Client,
  verifyS3Object,
  deleteS3Object,
  sanitizeFilename,
  directUploadToS3,
  validateFileMetadata,
  validateMagicBytes,
} from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getDriveClientForAdmin, uploadTaskSubmissionToDrive } from '@/lib/googleDrive';
import crypto from 'crypto';
import path from 'path';

export async function POST(request: Request) {
  let uploadedS3Key: string | null = null;
  try {
    const user = await requireAuth(['STUDENT']);

    let trainingDayId = '';
    let description = '';
    let s3Key = '';
    let originalFilename = '';
    let fileSize = 0;
    let mimeType = '';
    let directFile: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      trainingDayId = (formData.get('trainingDayId') as string) || '';
      description = (formData.get('description') as string) || '';
      s3Key = (formData.get('s3Key') as string) || '';
      originalFilename = (formData.get('originalFilename') as string) || '';
      fileSize = parseInt((formData.get('fileSize') as string) || '0', 10);
      mimeType = (formData.get('mimeType') as string) || '';
      directFile = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      trainingDayId = body.trainingDayId || '';
      description = body.description || '';
      s3Key = body.s3Key || '';
      originalFilename = body.originalFilename || '';
      fileSize = Number(body.fileSize) || 0;
      mimeType = body.mimeType || '';
    }

    if (!trainingDayId) {
      return NextResponse.json({ error: 'Training day ID is required' }, { status: 400 });
    }

    // 1. Fetch authenticated student & batch
    const student = await prisma.student.findUnique({
      where: { id: user.id },
      include: { batch: true },
    });

    if (!student || !student.batch) {
      return NextResponse.json({ error: 'Student or batch record not found' }, { status: 404 });
    }

    // 2. Server-side Attendance Gate: Require BOTH FN and AN attendance for today
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const timezone = settingsMap.get('PROGRAM_TIMEZONE') || DEFAULT_TIMEZONE;
    const todayDate = getMidnightDate(new Date(), timezone);

    const attendances = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        date: todayDate,
      },
    });

    const hasFN = attendances.some((a) => a.session === 'FN');
    const hasAN = attendances.some((a) => a.session === 'AN');

    if (!hasFN || !hasAN) {
      return NextResponse.json(
        {
          error: 'Task submission is locked. You must mark both FN (morning) and AN (afternoon) attendance for today before submitting your task solution.',
          fnMarked: hasFN,
          anMarked: hasAN,
        },
        { status: 403 }
      );
    }

    // 3. Fetch TrainingDay details
    const trainingDay = await prisma.trainingDay.findUnique({
      where: { id: trainingDayId },
    });

    if (!trainingDay || trainingDay.batchId !== student.batchId) {
      return NextResponse.json({ error: 'Invalid training day' }, { status: 400 });
    }

    let verifiedSize = fileSize;
    let verifiedMime = mimeType;
    let finalS3Key = s3Key;
    let finalFilename = originalFilename;

    // 4. Handle S3 Direct Upload Verification (Primary Modern Path)
    if (s3Key) {
      uploadedS3Key = s3Key;
      const verification = await verifyS3Object({
        s3Key,
        expectedMime: mimeType,
        expectedSize: fileSize,
      });

      if (!verification.verified) {
        // Orphan cleanup on failed verification
        await deleteS3Object(s3Key);
        return NextResponse.json(
          { error: `File verification failed: ${verification.error || 'Invalid upload'}` },
          { status: 400 }
        );
      }

      verifiedSize = verification.actualSize;
      verifiedMime = verification.actualMime;
      finalS3Key = s3Key;
      finalFilename = sanitizeFilename(originalFilename || path.basename(s3Key));
    }
    // 5. Handle Direct Multipart File Upload (Backward-Compatibility Fallback)
    else if (directFile && directFile.size > 0) {
      const validation = validateFileMetadata(directFile.name, directFile.type, directFile.size);
      if (!validation.valid || !validation.cleanExt) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const bytes = await directFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Magic byte check
      if (!validateMagicBytes(buffer, validation.normalizedMime!)) {
        return NextResponse.json(
          { error: `File header magic bytes do not match declared format "${validation.cleanExt}".` },
          { status: 400 }
        );
      }

      const cleanRegNo = student.registerNo.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const randomSuffix = crypto.randomBytes(6).toString('hex');
      const key = `submissions/${encodeURIComponent(student.batch.id)}/${encodeURIComponent(trainingDay.id)}/${encodeURIComponent(student.id)}_${Date.now()}_${randomSuffix}.${validation.cleanExt}`;

      await directUploadToS3({
        buffer,
        s3Key: key,
        mimeType: validation.normalizedMime!,
        originalFilename: directFile.name,
        studentId: student.id,
      });

      uploadedS3Key = key;
      finalS3Key = key;
      verifiedSize = directFile.size;
      verifiedMime = validation.normalizedMime!;
      finalFilename = sanitizeFilename(directFile.name);
    } else if (!description.trim()) {
      return NextResponse.json({ error: 'Please select a task file to submit.' }, { status: 400 });
    }

    // 6. Check for existing submission to clean up previous S3 object (Orphan prevention)
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        studentId_trainingDayId: {
          studentId: student.id,
          trainingDayId: trainingDay.id,
        },
      },
    });

    if (existingSubmission?.s3Key && finalS3Key && existingSubmission.s3Key !== finalS3Key) {
      // Remove old superseded file from S3
      await deleteS3Object(existingSubmission.s3Key);
    }

    const storedFilename = finalS3Key
      ? `${student.registerNo}_Day${trainingDay.dayNumber}${path.extname(finalS3Key)}`
      : undefined;

    // 7. Persist or Update TaskSubmission in PostgreSQL
    const submission = await prisma.taskSubmission.upsert({
      where: {
        studentId_trainingDayId: {
          studentId: student.id,
          trainingDayId: trainingDay.id,
        },
      },
      update: {
        ...(finalS3Key ? { s3Key: finalS3Key } : {}),
        s3Bucket: finalS3Key ? getBucketName() : undefined,
        s3Region: finalS3Key ? (process.env.AWS_REGION || 'us-east-1') : undefined,
        storageProvider: finalS3Key ? 'S3' : undefined,
        ...(finalFilename ? { originalFilename: finalFilename } : {}),
        ...(storedFilename ? { storedFilename } : {}),
        ...(verifiedSize ? { fileSize: verifiedSize } : {}),
        ...(verifiedMime ? { fileType: verifiedMime } : {}),
        description: description || undefined,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      create: {
        studentId: student.id,
        trainingDayId: trainingDay.id,
        screenshotUrl: '',
        s3Key: finalS3Key || undefined,
        s3Bucket: finalS3Key ? getBucketName() : undefined,
        s3Region: finalS3Key ? (process.env.AWS_REGION || 'us-east-1') : undefined,
        storageProvider: finalS3Key ? 'S3' : undefined,
        originalFilename: finalFilename || undefined,
        storedFilename: storedFilename || undefined,
        fileSize: verifiedSize || undefined,
        fileType: verifiedMime || undefined,
        description: description || '',
        status: 'SUBMITTED',
      },
    });

    // 8. Auto-Sync to Google Drive if connected
    let googleDriveFileId: string | undefined = undefined;
    let googleDriveFolderId: string | undefined = undefined;

    try {
      const { drive } = await getDriveClientForAdmin();
      if (drive) {
        let fileBuffer: Buffer | null = null;
        if (directFile) {
          fileBuffer = Buffer.from(await directFile.arrayBuffer());
        } else if (finalS3Key) {
          const s3 = getS3Client();
          const s3Obj = await s3.send(new GetObjectCommand({ Bucket: getBucketName(), Key: finalS3Key }));
          if (s3Obj.Body) {
            const chunks: Buffer[] = [];
            for await (const chunk of s3Obj.Body as any) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            fileBuffer = Buffer.concat(chunks);
          }
        }

        if (fileBuffer && fileBuffer.length > 0) {
          const batchName = student.batch.batchNo || student.batch.name;
          const driveResult = await uploadTaskSubmissionToDrive({
            fileBuffer,
            originalFilename: finalFilename || 'submission',
            mimeType: verifiedMime || 'application/octet-stream',
            batchId: student.batch.id,
            batchName,
            dayNumber: trainingDay.dayNumber,
            registerNo: student.registerNo,
          });
          googleDriveFileId = driveResult.googleDriveFileId;
          googleDriveFolderId = driveResult.googleDriveFolderId;
        }
      }
    } catch (driveErr) {
      console.warn('Google Drive auto-sync notice (non-fatal):', driveErr);
    }

    // 9. Update screenshotUrl and Google Drive metadata
    const secureUrl = `/api/submissions/${submission.id}/file`;
    const updated = await prisma.taskSubmission.update({
      where: { id: submission.id },
      data: {
        screenshotUrl: secureUrl,
        ...(googleDriveFileId ? { googleDriveFileId, googleDriveFolderId } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task solution submitted successfully to private secure cloud storage and Google Drive!',
      submission: updated,
      storage: googleDriveFileId ? 's3_and_google_drive' : 's3',
    });
  } catch (error: any) {
    // If database upsert or processing failed, clean up the newly uploaded S3 file
    if (uploadedS3Key) {
      await deleteS3Object(uploadedS3Key);
    }

    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Task submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Submission upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
