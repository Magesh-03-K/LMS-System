import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { revokeSession, isSessionRevoked } from './rateLimit';

export interface SessionUser {
  id: string;
  role: 'STUDENT' | 'ADMIN';
  name: string;
  registerNo?: string;
  email?: string;
  batchId?: string;
}

export interface SessionData {
  user?: SessionUser;
  sessionId?: string;
  createdAt?: number;
  lastActiveAt?: number;
}

// Session Lifetime Enforcements
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours idle timeout
export const STUDENT_ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours max
export const ADMIN_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours max

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_arvr',
  cookieName: 'arvr_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours max cookie lifetime
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  // Check if session has been explicitly revoked (e.g. via Logout)
  if (session.sessionId) {
    const revoked = await isSessionRevoked(session.sessionId);
    if (revoked) {
      session.destroy();
      return await getIronSession<SessionData>(cookieStore, sessionOptions);
    }
  }

  // Validate session freshness and timeouts
  if (session.user && session.createdAt && session.lastActiveAt) {
    const now = Date.now();
    const isIdle = now - session.lastActiveAt > IDLE_TIMEOUT_MS;
    const maxLifetime =
      session.user.role === 'ADMIN' ? ADMIN_ABSOLUTE_TIMEOUT_MS : STUDENT_ABSOLUTE_TIMEOUT_MS;
    const isExpired = now - session.createdAt > maxLifetime;

    if (isIdle || isExpired) {
      if (session.sessionId) {
        await revokeSession(session.sessionId);
      }
      session.destroy();
      return await getIronSession<SessionData>(cookieStore, sessionOptions);
    }

    // Refresh idle activity timestamp
    session.lastActiveAt = now;
    await session.save();
  }

  return session;
}

export async function createSession(user: SessionUser): Promise<void> {
  const session = await getSession();
  const now = Date.now();
  session.user = user;
  session.sessionId = crypto.randomUUID();
  session.createdAt = now;
  session.lastActiveAt = now;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  if (session.sessionId) {
    await revokeSession(session.sessionId);
  }
  session.destroy();
}

export async function hashPinOrPassword(pinOrPass: string): Promise<string> {
  return await bcrypt.hash(pinOrPass, 10);
}

export async function comparePinOrPassword(plain: string, hashed: string): Promise<boolean> {
  return await bcrypt.compare(plain, hashed);
}

export async function requireAuth(allowedRoles?: ('STUDENT' | 'ADMIN')[]) {
  const session = await getSession();
  if (!session.user) {
    throw new Error('UNAUTHORIZED');
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error('FORBIDDEN');
  }
  return session.user;
}
