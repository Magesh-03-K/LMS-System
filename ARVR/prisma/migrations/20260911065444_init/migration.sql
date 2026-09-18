-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registerNo" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchNo" TEXT,
    "level" TEXT DEFAULT 'Level 1',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "trainingDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "curriculumStatus" TEXT DEFAULT 'Not Set',
    "googleDriveFolderId" TEXT,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDay" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "taskDescription" TEXT NOT NULL,

    CONSTRAINT "TrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "session" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainingDayId" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "description" TEXT,
    "s3Key" TEXT,
    "s3Bucket" TEXT,
    "s3Region" TEXT,
    "storageProvider" TEXT DEFAULT 'S3',
    "googleDriveFileId" TEXT,
    "googleDriveFolderId" TEXT,
    "originalFilename" TEXT,
    "storedFilename" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "trainingLevel" TEXT NOT NULL,
    "comments" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "finalGrade" TEXT NOT NULL,
    "finalLevel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),

    CONSTRAINT "CertificateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleDriveConnection" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "googleAccountEmail" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_registerNo_key" ON "Student"("registerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_batchId_idx" ON "Student"("batchId");

-- CreateIndex
CREATE INDEX "Student_department_idx" ON "Student"("department");

-- CreateIndex
CREATE INDEX "Student_section_idx" ON "Student"("section");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchNo_key" ON "Batch"("batchNo");

-- CreateIndex
CREATE INDEX "TrainingDay_batchId_idx" ON "TrainingDay"("batchId");

-- CreateIndex
CREATE INDEX "TrainingDay_date_idx" ON "TrainingDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDay_batchId_dayNumber_key" ON "TrainingDay"("batchId", "dayNumber");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_session_key" ON "Attendance"("studentId", "date", "session");

-- CreateIndex
CREATE INDEX "TaskSubmission_studentId_idx" ON "TaskSubmission"("studentId");

-- CreateIndex
CREATE INDEX "TaskSubmission_trainingDayId_idx" ON "TaskSubmission"("trainingDayId");

-- CreateIndex
CREATE INDEX "TaskSubmission_status_idx" ON "TaskSubmission"("status");

-- CreateIndex
CREATE INDEX "TaskSubmission_submittedAt_idx" ON "TaskSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "TaskSubmission_s3Key_idx" ON "TaskSubmission"("s3Key");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmission_studentId_trainingDayId_key" ON "TaskSubmission"("studentId", "trainingDayId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_taskId_key" ON "Evaluation"("taskId");

-- CreateIndex
CREATE INDEX "Evaluation_studentId_idx" ON "Evaluation"("studentId");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatedAt_idx" ON "Evaluation"("evaluatedAt");

-- CreateIndex
CREATE INDEX "Feedback_studentId_idx" ON "Feedback"("studentId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRecord_studentId_key" ON "CertificateRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRecord_certificateNo_key" ON "CertificateRecord"("certificateNo");

-- CreateIndex
CREATE INDEX "CertificateRecord_studentId_idx" ON "CertificateRecord"("studentId");

-- CreateIndex
CREATE INDEX "CertificateRecord_completedAt_idx" ON "CertificateRecord"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDriveConnection_adminId_key" ON "GoogleDriveConnection"("adminId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDay" ADD CONSTRAINT "TrainingDay_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRecord" ADD CONSTRAINT "CertificateRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
