import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { features } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Health check (spec §47 system health). Reports DB + integration status. */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json({
    status: db ? 'ok' : 'degraded',
    db,
    integrations: {
      aiLive: features.aiLive,
      stripeLive: features.stripeLive,
      emailLive: features.emailLive,
    },
    time: new Date().toISOString(),
  });
}
