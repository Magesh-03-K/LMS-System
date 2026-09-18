import { uploadTaskSubmissionToDrive, getDriveClientForAdmin } from '../lib/googleDrive';
import { prisma } from '../lib/prisma';

async function testDriveUpload() {
  const { drive, connection, error } = await getDriveClientForAdmin();
  if (error || !drive) {
    console.log('Google Drive not connected:', error);
    return;
  }
  console.log('Connected to Drive account:', connection?.googleAccountEmail);

  // Find an active batch
  const batch = await prisma.batch.findFirst({
    include: { trainingCalendar: true, students: true }
  });

  if (!batch) {
    console.log('No batch found');
    return;
  }

  console.log(`Testing upload for Batch: "${batch.name}" (ID: ${batch.id})`);

  const dummyBuffer = Buffer.from('Dummy VR task solution screenshot file content');
  const result = await uploadTaskSubmissionToDrive({
    fileBuffer: dummyBuffer,
    originalFilename: 'test_task_solution.png',
    mimeType: 'image/png',
    batchId: batch.id,
    batchName: batch.name,
    dayNumber: 1,
    registerNo: 'TEST_STUDENT',
  });

  console.log('Upload to Google Drive result:', result);
}

testDriveUpload().catch(console.error);
