import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importPostgres() {
  const exportPath = path.join(process.cwd(), 'prisma', 'sqlite-data-export.json');
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export file not found at ${exportPath}`);
  }

  const exportContent = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  const { data, counts: expectedCounts } = exportContent;

  console.log('=== STARTING POSTGRESQL DATA RESTORATION ===');
  console.log(`Source export timestamp: ${exportContent.exportedAt}`);

  // 1. System Settings
  console.log(`Importing SystemSettings (${data.systemSettings?.length || 0})...`);
  for (const s of data.systemSettings || []) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {
        value: s.value,
        updatedAt: new Date(s.updatedAt),
      },
      create: {
        id: s.id,
        key: s.key,
        value: s.value,
        updatedAt: new Date(s.updatedAt),
      },
    });
  }

  // 2. Admins
  console.log(`Importing Admins (${data.admins?.length || 0})...`);
  for (const a of data.admins || []) {
    await prisma.admin.upsert({
      where: { email: a.email },
      update: {
        name: a.name,
        passwordHash: a.passwordHash,
      },
      create: {
        id: a.id,
        name: a.name,
        email: a.email,
        passwordHash: a.passwordHash,
      },
    });
  }

  // 3. GoogleDriveConnection
  console.log(`Importing GoogleDriveConnections (${data.googleDriveConnections?.length || 0})...`);
  for (const g of data.googleDriveConnections || []) {
    await prisma.googleDriveConnection.upsert({
      where: { id: g.id },
      update: {
        adminId: g.adminId,
        googleAccountEmail: g.googleAccountEmail,
        refreshTokenEncrypted: g.refreshTokenEncrypted,
        rootFolderId: g.rootFolderId,
        status: g.status,
        connectedAt: new Date(g.connectedAt),
        updatedAt: new Date(g.updatedAt),
      },
      create: {
        id: g.id,
        adminId: g.adminId,
        googleAccountEmail: g.googleAccountEmail,
        refreshTokenEncrypted: g.refreshTokenEncrypted,
        rootFolderId: g.rootFolderId,
        status: g.status,
        connectedAt: new Date(g.connectedAt),
        updatedAt: new Date(g.updatedAt),
      },
    });
  }

  // 4. Batches
  console.log(`Importing Batches (${data.batches?.length || 0})...`);
  for (const b of data.batches || []) {
    await prisma.batch.upsert({
      where: { id: b.id },
      update: {
        name: b.name,
        batchNo: b.batchNo,
        level: b.level,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        trainingDays: b.trainingDays,
        status: b.status,
        curriculumStatus: b.curriculumStatus,
        googleDriveFolderId: b.googleDriveFolderId,
      },
      create: {
        id: b.id,
        name: b.name,
        batchNo: b.batchNo,
        level: b.level,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        trainingDays: b.trainingDays,
        status: b.status,
        curriculumStatus: b.curriculumStatus,
        googleDriveFolderId: b.googleDriveFolderId,
      },
    });
  }

  // 5. TrainingDays
  console.log(`Importing TrainingDays (${data.trainingDays?.length || 0})...`);
  for (const td of data.trainingDays || []) {
    await prisma.trainingDay.upsert({
      where: { id: td.id },
      update: {
        batchId: td.batchId,
        dayNumber: td.dayNumber,
        date: new Date(td.date),
        taskTitle: td.taskTitle,
        taskDescription: td.taskDescription,
      },
      create: {
        id: td.id,
        batchId: td.batchId,
        dayNumber: td.dayNumber,
        date: new Date(td.date),
        taskTitle: td.taskTitle,
        taskDescription: td.taskDescription,
      },
    });
  }

  // 6. Students
  console.log(`Importing Students (${data.students?.length || 0})...`);
  for (const s of data.students || []) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        registerNo: s.registerNo,
        contactNumber: s.contactNumber,
        email: s.email,
        department: s.department,
        year: s.year,
        section: s.section,
        batchId: s.batchId,
        pinHash: s.pinHash,
        createdAt: new Date(s.createdAt),
      },
      create: {
        id: s.id,
        name: s.name,
        registerNo: s.registerNo,
        contactNumber: s.contactNumber,
        email: s.email,
        department: s.department,
        year: s.year,
        section: s.section,
        batchId: s.batchId,
        pinHash: s.pinHash,
        createdAt: new Date(s.createdAt),
      },
    });
  }

  // 7. Attendances
  console.log(`Importing Attendances (${data.attendances?.length || 0})...`);
  for (const a of data.attendances || []) {
    await prisma.attendance.upsert({
      where: { id: a.id },
      update: {
        studentId: a.studentId,
        date: new Date(a.date),
        session: a.session,
        markedAt: new Date(a.markedAt),
      },
      create: {
        id: a.id,
        studentId: a.studentId,
        date: new Date(a.date),
        session: a.session,
        markedAt: new Date(a.markedAt),
      },
    });
  }

  // 8. TaskSubmissions
  console.log(`Importing TaskSubmissions (${data.taskSubmissions?.length || 0})...`);
  for (const ts of data.taskSubmissions || []) {
    await prisma.taskSubmission.upsert({
      where: { id: ts.id },
      update: {
        studentId: ts.studentId,
        trainingDayId: ts.trainingDayId,
        screenshotUrl: ts.screenshotUrl,
        description: ts.description,
        googleDriveFileId: ts.googleDriveFileId,
        googleDriveFolderId: ts.googleDriveFolderId,
        originalFilename: ts.originalFilename,
        storedFilename: ts.storedFilename,
        fileSize: ts.fileSize,
        fileType: ts.fileType,
        status: ts.status,
        submittedAt: new Date(ts.submittedAt),
      },
      create: {
        id: ts.id,
        studentId: ts.studentId,
        trainingDayId: ts.trainingDayId,
        screenshotUrl: ts.screenshotUrl,
        description: ts.description,
        googleDriveFileId: ts.googleDriveFileId,
        googleDriveFolderId: ts.googleDriveFolderId,
        originalFilename: ts.originalFilename,
        storedFilename: ts.storedFilename,
        fileSize: ts.fileSize,
        fileType: ts.fileType,
        status: ts.status,
        submittedAt: new Date(ts.submittedAt),
      },
    });
  }

  // 9. Evaluations
  console.log(`Importing Evaluations (${data.evaluations?.length || 0})...`);
  for (const ev of data.evaluations || []) {
    await prisma.evaluation.upsert({
      where: { id: ev.id },
      update: {
        studentId: ev.studentId,
        taskId: ev.taskId,
        score: ev.score,
        grade: ev.grade,
        trainingLevel: ev.trainingLevel,
        comments: ev.comments,
        evaluatedAt: new Date(ev.evaluatedAt),
      },
      create: {
        id: ev.id,
        studentId: ev.studentId,
        taskId: ev.taskId,
        score: ev.score,
        grade: ev.grade,
        trainingLevel: ev.trainingLevel,
        comments: ev.comments,
        evaluatedAt: new Date(ev.evaluatedAt),
      },
    });
  }

  // 10. Feedbacks
  console.log(`Importing Feedbacks (${data.feedbacks?.length || 0})...`);
  for (const fb of data.feedbacks || []) {
    await prisma.feedback.upsert({
      where: { id: fb.id },
      update: {
        studentId: fb.studentId,
        message: fb.message,
        createdAt: new Date(fb.createdAt),
      },
      create: {
        id: fb.id,
        studentId: fb.studentId,
        message: fb.message,
        createdAt: new Date(fb.createdAt),
      },
    });
  }

  // 11. CertificateRecords
  console.log(`Importing CertificateRecords (${data.certificates?.length || 0})...`);
  for (const c of data.certificates || []) {
    await prisma.certificateRecord.upsert({
      where: { id: c.id },
      update: {
        studentId: c.studentId,
        certificateNo: c.certificateNo,
        finalGrade: c.finalGrade,
        finalLevel: c.finalLevel,
        completedAt: c.completedAt ? new Date(c.completedAt) : null,
        exportedAt: c.exportedAt ? new Date(c.exportedAt) : null,
      },
      create: {
        id: c.id,
        studentId: c.studentId,
        certificateNo: c.certificateNo,
        finalGrade: c.finalGrade,
        finalLevel: c.finalLevel,
        completedAt: c.completedAt ? new Date(c.completedAt) : null,
        exportedAt: c.exportedAt ? new Date(c.exportedAt) : null,
      },
    });
  }

  // Verification
  console.log('\n=== VERIFYING POSTGRESQL DATA RECORD COUNTS ===');
  const actualCounts = {
    systemSettings: await prisma.systemSetting.count(),
    admins: await prisma.admin.count(),
    googleDriveConnections: await prisma.googleDriveConnection.count(),
    batches: await prisma.batch.count(),
    trainingDays: await prisma.trainingDay.count(),
    students: await prisma.student.count(),
    attendances: await prisma.attendance.count(),
    taskSubmissions: await prisma.taskSubmission.count(),
    evaluations: await prisma.evaluation.count(),
    feedbacks: await prisma.feedback.count(),
    certificates: await prisma.certificateRecord.count(),
  };

  let allMatched = true;
  for (const [key, expected] of Object.entries(expectedCounts)) {
    const actual = (actualCounts as any)[key];
    const match = actual === expected;
    if (!match) allMatched = false;
    console.log(`  ${match ? '✓' : '✗'} ${key}: expected ${expected}, got ${actual}`);
  }

  if (allMatched) {
    console.log('\n🎉 ALL 11 MODELS PERFECTLY RESTORED IN POSTGRESQL!');
  } else {
    console.error('\n⚠️ Discrepancy detected during verification!');
  }
}

importPostgres()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
