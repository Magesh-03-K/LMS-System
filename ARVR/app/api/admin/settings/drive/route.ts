import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    const connection = await prisma.googleDriveConnection.findFirst();
    const hasConnectionRecord = Boolean(connection && connection.status === 'CONNECTED' && connection.refreshTokenEncrypted);

    let isHealthy = false;
    let statusText = 'Not Connected';
    let healthMessage = 'Google Drive is not linked.';

    if (hasConnectionRecord) {
      const { testAdminDriveConnection } = await import('@/lib/googleDrive');
      const testResult = await testAdminDriveConnection();
      isHealthy = testResult.success;
      if (isHealthy) {
        statusText = 'Connected & Verified ✓';
        healthMessage = 'Google Drive storage is operational.';
      } else {
        statusText = 'Action Needed (Token Expired)';
        healthMessage = 'OAuth token has expired or was revoked. Please click Reconnect.';
      }
    }

    return NextResponse.json({
      success: true,
      isConnected: hasConnectionRecord && isHealthy,
      hasConnectionRecord,
      isHealthy,
      status: statusText,
      message: healthMessage,
      connectedAccount: hasConnectionRecord ? connection?.googleAccountEmail || 'Connected Google Account' : null,
      connectedAt: hasConnectionRecord ? connection?.connectedAt : null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch Google Drive status' }, { status: 500 });
  }
}
