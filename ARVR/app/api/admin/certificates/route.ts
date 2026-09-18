import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const studentId = searchParams.get('studentId');

    const where: any = {};
    if (studentId) {
      where.studentId = studentId;
    } else if (batchId && batchId !== 'All') {
      where.student = { batchId };
    }

    const certificates = await prisma.certificateRecord.findMany({
      where,
      include: {
        student: {
          include: {
            batch: true,
            attendances: true,
            tasks: {
              include: { evaluation: true },
            },
            evaluations: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    return NextResponse.json({ certificates });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch certificates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();
    const {
      studentId,
      certificateNo,
      finalGrade,
      finalLevel,
      isValid = true,
      isManualOverride = true,
      overrideReason,
    } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        batch: { include: { trainingCalendar: true } },
        attendances: true,
        certificate: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const totalDays = student.batch.trainingDays || student.batch.trainingCalendar.length || 10;
    const maxSessions = student.batch.trainingCalendar.length > 0
      ? student.batch.trainingCalendar.reduce((sum, day) => sum + (day.hasForenoon !== false ? 1 : 0) + (day.hasAfternoon !== false ? 1 : 0), 0)
      : totalDays * 2;
    const currentAttPct = maxSessions > 0 ? Math.min(100, Math.round((student.attendances.length / maxSessions) * 100)) : 100;

    // Sanitize and format certificate number
    let certNo = (certificateNo || '').trim().toUpperCase();
    if (!certNo) {
      const cleanBatchCode = student.batch.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
      const randomSuffix = String(student.registerNo).slice(-4) || '001';
      certNo = `ARVR-${cleanBatchCode}-${randomSuffix}`;
    }

    // Check if certificate number is already used by another student
    const existingWithCertNo = await prisma.certificateRecord.findFirst({
      where: {
        certificateNo: certNo,
        studentId: { not: student.id },
      },
    });
    if (existingWithCertNo) {
      return NextResponse.json(
        { error: `Certificate number "${certNo}" is already assigned to another student. Please enter a unique certificate number.` },
        { status: 400 }
      );
    }

    let gradeToSave = String(finalGrade || 'A+').trim();
    if (gradeToSave === 'A_PLUS') gradeToSave = 'A+';
    if (gradeToSave === 'B_PLUS') gradeToSave = 'B+';
    const levelToSave = (finalLevel || 'Level 1 Foundation').trim();
    const reasonToSave = (overrideReason || 'Admin manual override & data modification').trim();

    let certificate;
    if (student.certificate) {
      certificate = await prisma.certificateRecord.update({
        where: { id: student.certificate.id },
        data: {
          certificateNo: certNo,
          finalGrade: gradeToSave,
          finalLevel: levelToSave,
          isValid: Boolean(isValid),
          isManualOverride: Boolean(isManualOverride),
          overrideReason: reasonToSave,
          completedAt: student.certificate.completedAt || new Date(),
          attendancePctAtIssue: currentAttPct,
        },
      });
    } else {
      certificate = await prisma.certificateRecord.create({
        data: {
          studentId: student.id,
          certificateNo: certNo,
          finalGrade: gradeToSave,
          finalLevel: levelToSave,
          isValid: Boolean(isValid),
          isManualOverride: Boolean(isManualOverride),
          overrideReason: reasonToSave,
          completedAt: new Date(),
          attendancePctAtIssue: currentAttPct,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Certificate for ${student.name} (${student.registerNo}) updated successfully!`,
      certificate,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Manual certificate update error:', error);
    let errMsg = error.message || 'Failed to update certificate';
    if (errMsg.includes('Unique constraint failed')) {
      errMsg = 'Certificate number or student record collision. Please verify uniqueness.';
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const { searchParams } = new URL(request.url);
    const certificateId = searchParams.get('id');
    const studentId = searchParams.get('studentId');

    if (!certificateId && !studentId) {
      return NextResponse.json({ error: 'Certificate ID or Student ID required' }, { status: 400 });
    }

    if (certificateId) {
      await prisma.certificateRecord.delete({ where: { id: certificateId } });
    } else if (studentId) {
      await prisma.certificateRecord.deleteMany({ where: { studentId } });
    }

    return NextResponse.json({ success: true, message: 'Certificate record revoked/deleted successfully.' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to revoke certificate' }, { status: 500 });
  }
}
