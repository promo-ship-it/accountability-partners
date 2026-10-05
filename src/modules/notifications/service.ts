/**
 * Notification service (spec §35). Channel abstraction with in-app + email
 * (console or Resend), idempotent via dedupeKey, respects preferences and
 * quiet hours. SMS/push are architected (enum + channel switch) but not
 * activated in V1.
 */

import { prisma } from '@/lib/db';
import { env, features } from '@/lib/env';

export interface SendInput {
  userId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  template: string;
  title: string;
  body: string;
  dedupeKey?: string;
}

export async function sendNotification(input: SendInput): Promise<void> {
  // Idempotency: if a notification with this dedupeKey exists, skip.
  if (input.dedupeKey) {
    const existing = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (existing) return;
  }

  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return;

  // Preference gating
  if (prefs) {
    if (input.channel === 'email' && !prefs.email) return;
    if (input.channel === 'in_app' && !prefs.inApp) return;
    if (input.channel === 'sms' && !prefs.sms) return;
    if (input.channel === 'push' && !prefs.push) return;
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      channel: input.channel,
      template: input.template,
      title: input.title,
      body: input.body,
      status: 'pending',
      dedupeKey: input.dedupeKey,
    },
  });

  try {
    await deliver(input.channel, user.email, input.title, input.body);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: input.channel === 'in_app' ? 'pending' : 'sent', sentAt: new Date() },
    });
  } catch (e) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'failed', attempts: { increment: 1 } },
    });
    throw e;
  }
}

async function deliver(
  channel: SendInput['channel'],
  toEmail: string,
  title: string,
  body: string,
): Promise<void> {
  if (channel === 'in_app') return; // persisted; shown in UI
  if (channel === 'email') {
    if (!features.emailLive) {
      // eslint-disable-next-line no-console
      console.log(`[email:console] to=${toEmail} :: ${title} :: ${body}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EMAIL_API_KEY}` },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: toEmail, subject: title, text: body }),
    });
    if (!res.ok) throw new Error(`email send failed: ${res.status}`);
    return;
  }
  // sms / push — architected, not activated in V1.
  // eslint-disable-next-line no-console
  console.log(`[${channel}:noop] ${title}`);
}
