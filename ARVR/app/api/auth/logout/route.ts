import { NextResponse } from 'next/server';
import { getSession, destroySession } from '@/lib/auth';
import { getClientIp, logSecurityEvent } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const session = await getSession();

    if (session.user) {
      logSecurityEvent({
        type: 'AUTH_LOGOUT',
        ip,
        actorId: session.user.id,
        actorRole: session.user.role,
        targetIdentifier: session.user.email || session.user.registerNo,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    await destroySession();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to destroy session' }, { status: 500 });
  }
}
