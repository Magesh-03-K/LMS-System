import { PrismaClient } from '@prisma/client';
import http from 'http';
import { getS3Client, getBucketName } from '../lib/s3';
import { getMidnightDate } from '../lib/time';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function record(name: string, ok: boolean, details?: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
  }
}

interface RequestOptions {
  path: string;
  method?: string;
  body?: any;
  cookie?: string;
}

interface ResponseResult {
  status: number;
  cookie?: string;
  data: any;
  headers: http.IncomingHttpHeaders;
}

function makeRequest(options: RequestOptions): Promise<ResponseResult> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const randomIp = `192.168.50.${Math.floor(Math.random() * 200) + 10}`;
    const headers: Record<string, string> = {
      'x-forwarded-for': randomIp,
    };

    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: options.path,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        const rawCookies: string[] = [];
        const setCookieHeader = res.headers['set-cookie'];
        if (Array.isArray(setCookieHeader)) {
          rawCookies.push(...setCookieHeader);
        } else if (setCookieHeader) {
          rawCookies.push(setCookieHeader);
        }

        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }

          resolve({
            status: res.statusCode || 500,
            cookie: rawCookies.map((c) => c.split(';')[0]).join('; '),
            data: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runS3Tests() {
  console.log('================================================================');
  console.log('🛡️  AWS S3 SECURE PRESIGNED UPLOAD & STORAGE AUDIT SUITE');
  console.log('================================================================\n');

  // 1. Authenticate Admin
  const adminLoginRes = await makeRequest({
    path: '/api/admin/login',
    method: 'POST',
    body: { email: 'admin@arvr.com', password: 'admin123' },
  });
  const adminCookie = adminLoginRes.cookie;
  record('Admin login authentication', adminLoginRes.status === 200, `Cookie: ${!!adminCookie}`);

  // 2. Fetch or create test student A (21CS001)
  let studentA = await prisma.student.findUnique({
    where: { registerNo: '21CS001' },
    include: { batch: { include: { trainingCalendar: { orderBy: { dayNumber: 'asc' } } } } },
  });

  if (!studentA) {
    throw new Error('Student 21CS001 not found in database');
  }

  const batch = studentA.batch;
  const trainingDay = batch.trainingCalendar[0];
  if (!trainingDay) throw new Error('No training day found in batch');

  // Ensure Attendance marked for today so upload gate is unlocked
  const today = getMidnightDate();

  await prisma.attendance.upsert({
    where: { studentId_date_session: { studentId: studentA.id, date: today, session: 'FN' } },
    update: {},
    create: { studentId: studentA.id, date: today, session: 'FN' },
  });
  await prisma.attendance.upsert({
    where: { studentId_date_session: { studentId: studentA.id, date: today, session: 'AN' } },
    update: {},
    create: { studentId: studentA.id, date: today, session: 'AN' },
  });

  // Authenticate Student A
  const studentALoginRes = await makeRequest({
    path: '/api/student/login',
    method: 'POST',
    body: { registerNo: '21CS001', pin: '123456' },
  });
  const studentACookie = studentALoginRes.cookie;
  record('Student A login authentication', studentALoginRes.status === 200, `Cookie: ${!!studentACookie}`);

  // 3. Ensure Student B exists for unauthorized RBAC test
  let studentB = await prisma.student.findUnique({ where: { registerNo: '21CS002' } });
  if (!studentB) {
    const bcrypt = await import('bcryptjs');
    studentB = await prisma.student.create({
      data: {
        name: 'Bob Student B',
        registerNo: '21CS002',
        contactNumber: '9888877777',
        email: 'student_b@test.edu',
        department: 'Computer Science',
        year: '3rd Year',
        section: 'Sec A',
        batchId: batch.id,
        pinHash: await bcrypt.hash('123456', 10),
      },
    });
  }

  const studentBLoginRes = await makeRequest({
    path: '/api/student/login',
    method: 'POST',
    body: { registerNo: '21CS002', pin: '123456' },
  });
  const studentBCookie = studentBLoginRes.cookie;
  record('Student B login authentication', studentBLoginRes.status === 200, `Cookie: ${!!studentBCookie}`);

  // -------------------------------------------------------------
  // TEST 1: Successful Upload Flow (Presigned URL -> S3 PUT -> Submit Confirmation)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 1: Successful Upload Flow ---');
  // 1x1 valid PNG buffer
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const presignedRes = await makeRequest({
    path: '/api/student/task/presigned-url',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      filename: 'my_vr_rig_demo.png',
      fileSize: validPngBuffer.length,
      mimeType: 'image/png',
    },
  });

  record(
    'Request presigned upload URL for valid PNG',
    presignedRes.status === 200 && !!presignedRes.data?.uploadUrl && !!presignedRes.data?.s3Key,
    `Key: ${presignedRes.data?.s3Key}`
  );

  const uploadUrl = presignedRes.data?.uploadUrl;
  const s3Key1 = presignedRes.data?.s3Key;

  // Direct PUT upload to S3 presigned URL
  const s3PutRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: validPngBuffer,
  });

  record('Direct browser-to-S3 PUT upload', s3PutRes.status === 200, `HTTP Status: ${s3PutRes.status}`);

  // Confirm submission with backend
  const confirmRes = await makeRequest({
    path: '/api/student/task/submit',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      s3Key: s3Key1,
      originalFilename: 'my_vr_rig_demo.png',
      fileSize: validPngBuffer.length,
      mimeType: 'image/png',
      description: 'Completed OpenXR Rig with teleportation system.',
    },
  });

  record(
    'Backend submission confirmation & S3 verification',
    confirmRes.status === 200 && confirmRes.data?.submission?.s3Key === s3Key1,
    `Submission ID: ${confirmRes.data?.submission?.id}`
  );

  const submissionAId = confirmRes.data?.submission?.id;

  // -------------------------------------------------------------
  // TEST 2: Invalid Extension Rejection
  // -------------------------------------------------------------
  console.log('\n--- Scenario 2: Invalid Extension Rejection ---');
  const invalidExtRes = await makeRequest({
    path: '/api/student/task/presigned-url',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      filename: 'payload.exe',
      fileSize: 1024,
      mimeType: 'application/x-msdownload',
    },
  });

  record(
    'Disallowed file extension (.exe) rejected with HTTP 400',
    invalidExtRes.status === 400 && invalidExtRes.data?.error?.includes('Invalid file extension'),
    `Error: ${invalidExtRes.data?.error}`
  );

  // -------------------------------------------------------------
  // TEST 3: Invalid / Mismatched MIME Rejection
  // -------------------------------------------------------------
  console.log('\n--- Scenario 3: Invalid MIME Rejection ---');
  const invalidMimeRes = await makeRequest({
    path: '/api/student/task/presigned-url',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      filename: 'document.png',
      fileSize: 1024,
      mimeType: 'application/pdf', // Mismatch!
    },
  });

  record(
    'Mismatched MIME type for extension rejected with HTTP 400',
    invalidMimeRes.status === 400 && invalidMimeRes.data?.error?.includes('MIME type'),
    `Error: ${invalidMimeRes.data?.error}`
  );

  // -------------------------------------------------------------
  // TEST 4: Oversized File (> 50 MB) Rejection
  // -------------------------------------------------------------
  console.log('\n--- Scenario 4: Oversized File Rejection ---');
  const oversizedRes = await makeRequest({
    path: '/api/student/task/presigned-url',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      filename: 'massive_video.mp4',
      fileSize: 55 * 1024 * 1024, // 55 MB (> 50 MB)
      mimeType: 'video/mp4',
    },
  });

  record(
    'Oversized file (55 MB > 50 MB limit) rejected with HTTP 400',
    oversizedRes.status === 400 && oversizedRes.data?.error?.includes('exceeds maximum limit'),
    `Error: ${oversizedRes.data?.error}`
  );

  // -------------------------------------------------------------
  // TEST 5: Unauthorized Download Access Protection (RBAC)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 5: Unauthorized Download Protection ---');
  // Student B tries to download Student A's submission
  const studentBDownloadRes = await makeRequest({
    path: `/api/submissions/${submissionAId}/file`,
    cookie: studentBCookie,
  });

  record(
    'Student B cannot download Student A submission (HTTP 403 Forbidden)',
    studentBDownloadRes.status === 403,
    `Status: ${studentBDownloadRes.status}`
  );

  // Unauthenticated caller tries to access submission
  const unauthDownloadRes = await makeRequest({
    path: `/api/submissions/${submissionAId}/file`,
  });

  record(
    'Unauthenticated request rejected with HTTP 401 Unauthorized',
    unauthDownloadRes.status === 401,
    `Status: ${unauthDownloadRes.status}`
  );

  // -------------------------------------------------------------
  // TEST 6: Authorized Download Access
  // -------------------------------------------------------------
  console.log('\n--- Scenario 6: Authorized Download Access ---');
  // Student A accesses their own file
  const studentADownloadRes = await makeRequest({
    path: `/api/submissions/${submissionAId}/file`,
    cookie: studentACookie,
  });

  const locA = (studentADownloadRes.headers['location'] as string) || '';
  record(
    'Student A can access own submission (HTTP 307 Redirect to S3 presigned URL)',
    studentADownloadRes.status === 307 && !!locA && locA.includes(s3Key1),
    `Redirect: ${locA.slice(0, 50)}...`
  );

  // Student A requests download with ?download=true
  const studentADownloadAttachRes = await makeRequest({
    path: `/api/submissions/${submissionAId}/file?download=true`,
    cookie: studentACookie,
  });

  const locAttach = (studentADownloadAttachRes.headers['location'] as string) || '';
  record(
    'Download attachment header attached in presigned redirect',
    studentADownloadAttachRes.status === 307 &&
      locAttach.includes('response-content-disposition=attachment'),
    `Disposition param present`
  );

  // Admin accesses Student A's submission
  const adminDownloadRes = await makeRequest({
    path: `/api/submissions/${submissionAId}/file`,
    cookie: adminCookie,
  });

  const locAdmin = (adminDownloadRes.headers['location'] as string) || '';
  record(
    'Admin/Instructor can access student submission for evaluation',
    adminDownloadRes.status === 307 && !!locAdmin,
    `Redirect: ${locAdmin.slice(0, 50)}...`
  );

  // -------------------------------------------------------------
  // TEST 7: Failed Upload Handling (Un-uploaded S3 Key rejection)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 7: Failed Upload Handling ---');
  const fakeS3Key = `submissions/${batch.id}/${trainingDay.id}/fake_unuploaded_${Date.now()}.png`;

  const failedUploadConfirmRes = await makeRequest({
    path: '/api/student/task/submit',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      s3Key: fakeS3Key,
      originalFilename: 'phantom.png',
      fileSize: 1024,
      mimeType: 'image/png',
      description: 'Attempting confirmation without S3 upload.',
    },
  });

  record(
    'Backend rejects confirmation if file was not actually uploaded to S3 (HTTP 400)',
    failedUploadConfirmRes.status === 400 && failedUploadConfirmRes.data?.error?.includes('File verification failed'),
    `Error: ${failedUploadConfirmRes.data?.error}`
  );

  // -------------------------------------------------------------
  // TEST 8: Duplicate Submission & Orphan S3 Object Cleanup
  // -------------------------------------------------------------
  console.log('\n--- Scenario 8: Duplicate Submission & Orphan Cleanup ---');
  // Generate a valid PDF buffer (starts with %PDF-1.4)
  const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

  const presignedPdfRes = await makeRequest({
    path: '/api/student/task/presigned-url',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      filename: 'my_vr_solution_v2.pdf',
      fileSize: validPdfBuffer.length,
      mimeType: 'application/pdf',
    },
  });

  const uploadUrl2 = presignedPdfRes.data?.uploadUrl;
  const s3Key2 = presignedPdfRes.data?.s3Key;

  await fetch(uploadUrl2, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: validPdfBuffer,
  });

  // Re-submit for the same training day
  const resubmitRes = await makeRequest({
    path: '/api/student/task/submit',
    method: 'POST',
    cookie: studentACookie,
    body: {
      trainingDayId: trainingDay.id,
      s3Key: s3Key2,
      originalFilename: 'my_vr_solution_v2.pdf',
      fileSize: validPdfBuffer.length,
      mimeType: 'application/pdf',
      description: 'Updated solution with PDF technical documentation.',
    },
  });

  record(
    'Duplicate/Resubmission updates existing TaskSubmission record',
    resubmitRes.status === 200 && resubmitRes.data?.submission?.s3Key === s3Key2,
    `New S3 Key: ${s3Key2}`
  );

  // Verify that the OLD S3 object (s3Key1) was deleted (orphan cleanup)
  const s3 = getS3Client();
  const bucket = getBucketName();
  let oldKeyExists = true;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key1 }));
    oldKeyExists = true;
  } catch (e: any) {
    oldKeyExists = false;
  }

  record(
    'Orphan prevention: previous S3 object was cleanly purged from bucket upon resubmission',
    !oldKeyExists,
    `Old Key Purged: ${!oldKeyExists}`
  );

  // -------------------------------------------------------------
  // TEST 9: Database Consistency Verification
  // -------------------------------------------------------------
  console.log('\n--- Scenario 9: Database Consistency Verification ---');
  const dbSubmission = await prisma.taskSubmission.findUnique({
    where: { id: submissionAId },
  });

  const isConsistent =
    dbSubmission?.s3Key === s3Key2 &&
    dbSubmission?.s3Bucket === 'arvr-submissions-private' &&
    dbSubmission?.storageProvider === 'S3' &&
    dbSubmission?.fileSize === validPdfBuffer.length &&
    dbSubmission?.fileType === 'application/pdf' &&
    dbSubmission?.originalFilename === 'my_vr_solution_v2.pdf' &&
    dbSubmission?.status === 'SUBMITTED' &&
    dbSubmission?.screenshotUrl === `/api/submissions/${submissionAId}/file`;

  record(
    'PostgreSQL TaskSubmission metadata strictly consistent with S3 object',
    !!isConsistent,
    `s3Key=${dbSubmission?.s3Key}, size=${dbSubmission?.fileSize}, mime=${dbSubmission?.fileType}`
  );

  console.log('\n================================================================');
  console.log(`📊 S3 SECURITY & UPLOAD AUDIT RESULT: ${passed}/${passed + failed} PASS`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runS3Tests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
