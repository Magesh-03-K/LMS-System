import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { directUploadToS3, sanitizeFilename, validateFileMetadata, validateMagicBytes } from '@/lib/s3';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    await requireAuth(['ADMIN']);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const originalFilename = file.name || 'resource_document';
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = file.size;

    // Validate metadata
    const validation = validateFileMetadata(originalFilename, mimeType, fileSize);
    if (!validation.valid || !validation.cleanExt) {
      return NextResponse.json({ error: validation.error || 'Invalid file format or size' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate magic bytes
    if (!validateMagicBytes(buffer, validation.normalizedMime || mimeType)) {
      return NextResponse.json({ error: 'File content does not match the expected MIME type.' }, { status: 400 });
    }

    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const safeName = sanitizeFilename(originalFilename);
    const s3Key = `resources/${Date.now()}_${randomSuffix}_${safeName}`;

    await directUploadToS3({
      buffer,
      s3Key,
      mimeType: validation.normalizedMime || mimeType,
      originalFilename: safeName,
    });

    const resourceType = validation.cleanExt === 'pdf' ? 'pdf' : ['mp4'].includes(validation.cleanExt) ? 'video' : ['zip', 'docx'].includes(validation.cleanExt) ? 'doc' : 'other';

    return NextResponse.json({
      success: true,
      url: `/api/resources/${encodeURIComponent(s3Key)}`,
      s3Key,
      filename: safeName,
      fileSize,
      mimeType: validation.normalizedMime || mimeType,
      type: resourceType,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Resource upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload resource' }, { status: 500 });
  }
}
