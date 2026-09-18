import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const { searchParams } = new URL(request.url);

    const batchId = searchParams.get('batchId');
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const section = searchParams.get('section');
    const search = searchParams.get('search');

    const where: any = {};

    if (batchId && batchId !== 'All') where.batchId = batchId;
    if (department && department !== 'All') where.department = department;
    if (year && year !== 'All') where.year = year;
    if (section && section !== 'All') where.section = section;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { registerNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 1000;
    const skip = limitParam ? (page - 1) * limit : 0;

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          batch: true,
          attendances: true,
          tasks: {
            include: {
              trainingDay: true,
              evaluation: true,
            },
          },
          evaluations: true,
          certificate: true,
          _count: {
            select: { attendances: true, tasks: true, evaluations: true },
          },
        },
        orderBy: { registerNo: 'asc' },
      }),
    ]);

    return NextResponse.json({
      students,
      pagination: limitParam
        ? {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          }
        : undefined,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();
    const { name, registerNo, contactNumber, email, department, year, section, batchId, pin } = body;

    if (!name || !registerNo || !email || !batchId || !pin) {
      return NextResponse.json({ error: 'Missing required student registration fields' }, { status: 400 });
    }

    if (name.length > 100 || registerNo.length > 50 || email.length > 100) {
      return NextResponse.json({ error: 'Input fields exceed maximum allowed character limits' }, { status: 400 });
    }

    const normalizedRegNo = registerNo.trim().toUpperCase();

    const existingReg = await prisma.student.findUnique({
      where: { registerNo: normalizedRegNo },
    });
    if (existingReg) {
      return NextResponse.json({ error: `Register Number "${normalizedRegNo}" is already registered.` }, { status: 409 });
    }

    if (email) {
      const existingEmail = await prisma.student.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json({ error: `Email "${email}" is already registered.` }, { status: 409 });
      }
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 numeric digits (e.g. 123456)' }, { status: 400 });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const cleanSection = section ? (section.startsWith('Sec') ? section : `Sec ${section}`) : 'Sec A';

    const student = await prisma.student.create({
      data: {
        name,
        registerNo: normalizedRegNo,
        contactNumber: contactNumber || '9999999999',
        email,
        department: department || 'Computer Science',
        year: year || '3rd Year',
        section: cleanSection,
        batchId,
        pinHash,
      },
      include: {
        batch: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Student '${student.name}' registered successfully!`,
      student,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Register student error:', error);
    return NextResponse.json({ error: error.message || 'Failed to register student' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();
    const { id, name, contactNumber, email, department, year, section, batchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required for update' }, { status: 400 });
    }

    const cleanSection = section ? (section.startsWith('Sec') ? section : `Sec ${section}`) : undefined;

    const student = await prisma.student.update({
      where: { id },
      data: {
        name: name || undefined,
        contactNumber: contactNumber || undefined,
        email: email || undefined,
        department: department || undefined,
        year: year || undefined,
        section: cleanSection,
        batchId: batchId || undefined,
      },
      include: {
        batch: true,
      },
    });

    return NextResponse.json({ success: true, message: 'Student profile updated successfully', student });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update student' }, { status: 500 });
  }
}
