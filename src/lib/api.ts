import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth';
import { OwnershipError } from '@/modules/goals/service';

/**
 * Uniform API responses. Never leak raw technical errors to the client
 * (spec §57) — map to safe messages + a support reference.
 */
export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return fail(e.errors[0]?.message ?? 'Invalid input.', 422);
  }
  if (e instanceof AuthError) {
    return fail(e.message, e.status);
  }
  if (e instanceof OwnershipError) {
    return fail(e.message, e.status);
  }
  if (e instanceof Error && /already exists/i.test(e.message)) {
    return fail(e.message, 409);
  }
  if (e instanceof Error && e.message === 'STRIPE_NOT_CONFIGURED') {
    return fail('Billing is not configured yet. Please contact support.', 503);
  }
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  // eslint-disable-next-line no-console
  console.error(`[api-error ${ref}]`, e);
  return fail(`Something went wrong. Reference: ${ref}`, 500);
}
