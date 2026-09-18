import { prisma } from '../lib/prisma';
import fs from 'fs/promises';
import path from 'path';

async function exportAllData() {
  console.log('📦 Starting full SQLite data export...');

  const systemSettings = await prisma.systemSetting.findMany();
  const admins = await prisma.admin.findMany();
  const googleDriveConnections = await prisma.googleDriveConnection.findMany();
  const batches = await prisma.batch.findMany();
  const trainingDays = await prisma.trainingDay.findMany();
  const students = await prisma.student.findMany();
  const attendances = await prisma.attendance.findMany();
  const taskSubmissions = await prisma.taskSubmission.findMany();
  const evaluations = await prisma.evaluation.findMany();
  const feedbacks = await prisma.feedback.findMany();
  const certificates = await prisma.certificateRecord.findMany();

  const exportData = {
    exportedAt: new Date().toISOString(),
    counts: {
      systemSettings: systemSettings.length,
      admins: admins.length,
      googleDriveConnections: googleDriveConnections.length,
      batches: batches.length,
      trainingDays: trainingDays.length,
      students: students.length,
      attendances: attendances.length,
      taskSubmissions: taskSubmissions.length,
      evaluations: evaluations.length,
      feedbacks: feedbacks.length,
      certificates: certificates.length,
    },
    data: {
      systemSettings,
      admins,
      googleDriveConnections,
      batches,
      trainingDays,
      students,
      attendances,
      taskSubmissions,
      evaluations,
      feedbacks,
      certificates,
    },
  };

  const exportPath = path.join(process.cwd(), 'prisma', 'sqlite-data-export.json');
  await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');

  console.log('✅ SQLite data successfully exported to:', exportPath);
  console.log('📊 Exported record counts:', exportData.counts);
}

exportAllData()
  .catch((e) => {
    console.error('❌ Failed to export SQLite data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
