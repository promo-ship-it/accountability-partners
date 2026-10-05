import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { env, adminEmails } from './env';

/**
 * Lightweight, dependency-free session auth.
 * - Passwords hashed with bcrypt.
 * - Session is a signed cookie containing an opaque session id persisted in DB.
 * No third-party auth provider => zero added cost and no vendor lock-in.
 * The surface (createSession / getCurrentUser / destroySession) is swappable.
 */

const COOKIE = 'ap_session';
const SESSION_TTL_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

function sign(value: string): string {
  const mac = createHmac('sha256', env.AUTH_SECRET).update(value).digest('hex');
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac('sha256', env.AUTH_SECRET).update(value).digest('hex');
  try {
    if (
      mac.length === expected.length &&
      timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    ) {
      return value;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const session = await prisma.session.create({
    data: { id: randomBytes(24).toString('hex'), userId, expiresAt },
  });
  cookies().set(COOKIE, sign(session.id), {
    httpOnly: true,
    secure: env.APP_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const raw = cookies().get(COOKIE)?.value;
  if (raw) {
    const id = unsign(raw);
    if (id) await prisma.session.deleteMany({ where: { id } });
  }
  cookies().delete(COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  role: 'customer' | 'admin';
  state: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const id = unsign(raw);
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
  const u = session.user;
  return { id: u.id, email: u.email, role: u.role, state: u.state };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError('Not authenticated');
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== 'admin' && !adminEmails.includes(u.email.toLowerCase())) {
    throw new AuthError('Admin access required', 403);
  }
  return u;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function isAdminEmail(email: string): boolean {
  return adminEmails.includes(email.toLowerCase());
}
