import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generatePresignedDownloadUrl, sanitizeFilename } from '@/lib/s3';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    // Both Students and Admins/Trainers can access learning resources
    await requireAuth(['STUDENT', 'ADMIN']);

    const resolvedParams = await params;
    const keyArray = resolvedParams.key || [];
    const rawKey = keyArray.map((part) => decodeURIComponent(part)).join('/');

    if (!rawKey) {
      return NextResponse.json({ error: 'Resource key is required' }, { status: 400 });
    }

    const s3Key = rawKey.startsWith('resources/') ? rawKey : `resources/${rawKey}`;
    const filename = s3Key.split('/').pop() || 'learning_resource';

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';

    const presignedUrl = await generatePresignedDownloadUrl({
      s3Key,
      filename: sanitizeFilename(filename),
      isDownload,
      expiresInSeconds: 3600, // 1 hour access
    });

    return NextResponse.redirect(presignedUrl, 307);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Resource fetch error:', error);
    return NextResponse.json({ error: 'Resource not found or inaccessible' }, { status: 404 });
  }
}
