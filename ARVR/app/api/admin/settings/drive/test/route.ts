import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { testAdminDriveConnection } from '@/lib/googleDrive';

export async function POST() {
  try {
    await requireAuth(['ADMIN']);

    const result = await testAdminDriveConnection();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      account: result.account || null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
      success: false,
      message: '✗ Google Drive connection failed.',
    });
  }
}
