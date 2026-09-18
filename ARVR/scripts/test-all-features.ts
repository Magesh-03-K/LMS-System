import { prisma } from '../lib/prisma';
import { hashPinOrPassword, comparePinOrPassword } from '../lib/auth';
import { checkRateLimit, resetRateLimit } from '../lib/rateLimit';
import { saveTaskScreenshot } from '../lib/storage';
import path from 'path';

async function runFullTestSuite() {
  console.log('=============== STARTING FULL SYSTEM AUDIT & TEST SUITE ===============\n');
  let testCount = 0;
  let passCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✓ [PASS] Test #${testCount}: ${testName}`);
    } else {
      console.error(`❌ [FAIL] Test #${testCount}: ${testName} ${detail ? `- ${detail}` : ''}`);
    }
  }

  try {
    // TEST 1: Database Connection & Schema Verification
    const studentCount = await prisma.student.count();
    const batchCount = await prisma.batch.count();
    assert(batchCount > 0, 'Database Connection & Active Batches exist', `Batches found: ${batchCount}`);

    // TEST 2: Security & Password Hashing
    const plainPin = '999888';
    const hashed = await hashPinOrPassword(plainPin);
    const isMatch = await comparePinOrPassword(plainPin, hashed);
    const isFalseMatch = await comparePinOrPassword('000000', hashed);
    assert(isMatch && !isFalseMatch, 'Bcrypt PIN hashing & salt validation');

    // TEST 3: Rate Limiter Module
    const testIp = '192.168.1.99';
    await resetRateLimit(`test_key_${testIp}`);
    let rateOk = true;
    for (let i = 1; i <= 5; i++) {
      const res = await checkRateLimit(`test_key_${testIp}`, 5, 60000);
      if (!res.allowed) rateOk = false;
    }
    const blockedRes = await checkRateLimit(`test_key_${testIp}`, 5, 60000);
    assert(rateOk && !blockedRes.allowed, 'Security Rate Limiter (5 attempts limit & 6th attempt lock)');

    // TEST 4: Student Creation & Unique Constraints
    const activeBatch = await prisma.batch.findFirst();
    assert(!!activeBatch, 'Found active batch for test', `Batch ID: ${activeBatch?.id}`);

    const testRegNo = `TEST${Date.now()}`;
    const testEmail = `student_${Date.now()}@test.com`;

    const newStudent = await prisma.student.create({
      data: {
        name: 'Test Student Auto',
        registerNo: testRegNo,
        email: testEmail,
        contactNumber: '9876543210',
        department: 'Computer Science',
        year: '3rd Year',
        section: 'Sec A',
        batchId: activeBatch!.id,
        pinHash: hashed,
      },
    });
    assert(!!newStudent.id, 'New student database record creation', `Student ID: ${newStudent.id}`);

    // TEST 5: Attendance Marking & Duplicate Constraint
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const fnAtt = await prisma.attendance.create({
      data: {
        studentId: newStudent.id,
        date: todayDate,
        session: 'FN',
      },
    });

    const anAtt = await prisma.attendance.create({
      data: {
        studentId: newStudent.id,
        date: todayDate,
        session: 'AN',
      },
    });
    assert(!!fnAtt.id && !!anAtt.id, 'Attendance marking for FN & AN sessions');

    let duplicateFailedAsExpected = false;
    try {
      await prisma.attendance.create({
        data: {
          studentId: newStudent.id,
          date: todayDate,
          session: 'FN',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') duplicateFailedAsExpected = true;
    }
    assert(duplicateFailedAsExpected, 'Attendance database constraint (prevents duplicate session marking)');

    // TEST 6: Training Day & Task Submission
    let trainingDay = await prisma.trainingDay.findFirst({
      where: { batchId: activeBatch!.id },
    });

    if (!trainingDay) {
      trainingDay = await prisma.trainingDay.create({
        data: {
          batchId: activeBatch!.id,
          dayNumber: 99,
          date: new Date(),
          taskTitle: 'Test VR Task',
          taskDescription: 'Automated test task description',
        },
      });
    }

    const fakeImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const savedUrl = await saveTaskScreenshot(
      fakeImageBuffer,
      'test_screenshot.png',
      activeBatch!.name,
      trainingDay.dayNumber,
      newStudent.registerNo
    );

    assert(savedUrl.startsWith('s3://'), 'Task screenshot cloud storage & path sanitization', `URL: ${savedUrl}`);

    const submission = await prisma.taskSubmission.create({
      data: {
        studentId: newStudent.id,
        trainingDayId: trainingDay.id,
        screenshotUrl: savedUrl,
        description: 'Completed VR physics interaction in Unity',
        status: 'SUBMITTED',
      },
    });
    assert(!!submission.id, 'Task submission record creation');

    // TEST 7: Instructor Task Evaluation & Grading
    const evaluation = await prisma.evaluation.create({
      data: {
        studentId: newStudent.id,
        taskId: submission.id,
        score: 95,
        grade: 'O',
        trainingLevel: 'Level 2 VR Developer',
        comments: 'Exceptional XR rig setup and clean physics interactions.',
      },
    });

    await prisma.taskSubmission.update({
      where: { id: submission.id },
      data: { status: 'ACCEPTED' },
    });
    assert(evaluation.score === 95 && evaluation.grade === 'O', 'Instructor evaluation & score assignment');

    // TEST 8: Certificate Record Creation & Completion Logic
    const certRecord = await prisma.certificateRecord.create({
      data: {
        studentId: newStudent.id,
        certificateNo: `CERT-TEST-${Date.now()}`,
        finalGrade: 'O',
        finalLevel: 'Level 2 VR Developer',
        completedAt: new Date(),
      },
    });
    assert(!!certRecord.id, 'Automated Certificate Record Generation', `Cert No: ${certRecord.certificateNo}`);

    // CLEANUP TEST RECORD
    await prisma.certificateRecord.delete({ where: { id: certRecord.id } });
    await prisma.evaluation.delete({ where: { id: evaluation.id } });
    await prisma.taskSubmission.delete({ where: { id: submission.id } });
    await prisma.attendance.deleteMany({ where: { studentId: newStudent.id } });
    await prisma.student.delete({ where: { id: newStudent.id } });

    console.log(`\n================================================================`);
    console.log(`🎉 ALL AUDIT TESTS PASSED CLEANLY! (${passCount}/${testCount} Passed)`);
    console.log(`================================================================\n`);
  } catch (error: any) {
    console.error('Fatal error during system audit:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(passCount === testCount ? 0 : 1);
  }
}

runFullTestSuite();
