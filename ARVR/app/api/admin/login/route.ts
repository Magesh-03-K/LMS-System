import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userLoginSchema } from '@/lib/validation';
import { comparePinOrPassword, createSession } from '@/lib/auth';
import { checkDualRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rateLimit';
import { getClientIp, logSecurityEvent, dummyBcryptCompare, formatSafeError } from '@/lib/security';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = userLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dual-Key Throttling: Check both IP volumetric and Account lockout
    const rateCheck = await checkDualRateLimit({
      ip,
      accountIdentifier: normalizedEmail,
      maxIpAttempts: 20,
      maxAccountAttempts: 5,
      ipWindowSec: 60,
      accountLockoutSec: 900, // 15 minutes lockout
    });

    if (!rateCheck.allowed) {
      logSecurityEvent({
        type: rateCheck.reason === 'ACCOUNT_LOCKED' ? 'ACCOUNT_LOCKED' : 'RATE_LIMIT_EXCEEDED',
        ip,
        userAgent,
        targetIdentifier: normalizedEmail,
        actorRole: 'ADMIN',
        details: { reason: rateCheck.reason, remainingSec: rateCheck.remainingSec },
      });

      return NextResponse.json(
        {
          error:
            rateCheck.reason === 'ACCOUNT_LOCKED'
              ? `Account temporarily locked due to multiple failed login attempts. Please wait ${rateCheck.remainingSec} seconds before trying again.`
              : `Too many requests from this network. Please wait ${rateCheck.remainingSec} seconds before retrying.`,
          remainingSec: rateCheck.remainingSec,
        },
        { status: 429 }
      );
    }

    // 2. Fetch administrator account
    const admin = await prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!admin) {
      // Side-channel timing attack mitigation: perform constant-time bcrypt compare
      await dummyBcryptCompare();
      await recordFailedAttempt(normalizedEmail, 900);

      logSecurityEvent({
        type: 'AUTH_LOGIN_FAILURE',
        ip,
        userAgent,
        targetIdentifier: normalizedEmail,
        actorRole: 'ADMIN',
        details: { reason: 'ACCOUNT_NOT_FOUND' },
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 3. Verify password
    const isMatch = await comparePinOrPassword(password, admin.passwordHash);
    if (!isMatch) {
      await recordFailedAttempt(normalizedEmail, 900);

      logSecurityEvent({
        type: 'AUTH_LOGIN_FAILURE',
        ip,
        userAgent,
        targetIdentifier: normalizedEmail,
        actorRole: 'ADMIN',
        details: { reason: 'INVALID_CREDENTIALS' },
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 4. Successful login: reset throttling counters
    await resetRateLimit(`ip:${ip}`);
    await resetRateLimit(normalizedEmail);

    // 5. Establish secure session
    const sessionUser = {
      id: admin.id,
      role: 'ADMIN' as const,
      name: admin.name,
      email: admin.email,
    };
    await createSession(sessionUser);

    logSecurityEvent({
      type: 'AUTH_LOGIN_SUCCESS',
      ip,
      userAgent,
      actorId: admin.id,
      actorRole: 'ADMIN',
      targetIdentifier: admin.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin login successful',
      user: sessionUser,
    });
  } catch (error: any) {
    return NextResponse.json(formatSafeError(error, 'Admin Login POST'), { status: 500 });
  }
}
