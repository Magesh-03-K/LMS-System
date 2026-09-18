import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hashPinOrPassword } from '@/lib/auth';

interface CSVStudentRow {
  name: string;
  registerNo: string;
  email: string;
  contactNumber?: string;
  department?: string;
  year?: string;
  section?: string;
  pin?: string;
}

export async function POST(request: Request) {
  try {
    await requireAuth(['ADMIN']);

    const body = await request.json();
    const { batchId, students: studentRows } = body as { batchId: string; students: CSVStudentRow[] };

    if (!batchId) {
      return NextResponse.json({ error: 'Target batch ID is required' }, { status: 400 });
    }

    if (!Array.isArray(studentRows) || studentRows.length === 0) {
      return NextResponse.json({ error: 'No student records provided in import payload' }, { status: 400 });
    }

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Target batch does not exist' }, { status: 404 });
    }

    // Fetch existing register numbers & emails for fast duplicate checking
    const existingStudents = await prisma.student.findMany({
      select: { registerNo: true, email: true },
    });

    const existingRegNos = new Set(existingStudents.map((s) => s.registerNo.toUpperCase()));
    const existingEmails = new Set(existingStudents.map((s) => s.email.toLowerCase()));

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const defaultPin = '123456';
    const defaultPinHash = await hashPinOrPassword(defaultPin);

    for (let i = 0; i < studentRows.length; i++) {
      const row = studentRows[i];
      const name = (row.name || '').trim();
      const registerNo = (row.registerNo || '').trim().toUpperCase();
      const email = (row.email || '').trim().toLowerCase();
      const contactNumber = (row.contactNumber || '9999999999').trim();
      const department = (row.department || 'Computer Science').trim();
      const year = (row.year || '3rd Year').trim();
      const section = (row.section || 'Sec A').trim();
      const customPin = (row.pin || '').trim();

      if (!name || !registerNo || !email) {
        skippedCount++;
        errors.push(`Row ${i + 1}: Name, Register Number, and Email are required.`);
        continue;
      }

      if (existingRegNos.has(registerNo)) {
        skippedCount++;
        errors.push(`Row ${i + 1} (${registerNo}): Register number already exists.`);
        continue;
      }

      if (existingEmails.has(email)) {
        skippedCount++;
        errors.push(`Row ${i + 1} (${email}): Email already registered.`);
        continue;
      }

      const pinHash = customPin ? await hashPinOrPassword(customPin) : defaultPinHash;

      await prisma.student.create({
        data: {
          name,
          registerNo,
          email,
          contactNumber,
          department,
          year,
          section,
          batchId,
          pinHash,
        },
      });

      existingRegNos.add(registerNo);
      existingEmails.add(email);
      importedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Bulk import completed! Successfully registered ${importedCount} student(s). ${skippedCount} row(s) skipped.`,
      importedCount,
      skippedCount,
      errors,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk student import' }, { status: 500 });
  }
}
