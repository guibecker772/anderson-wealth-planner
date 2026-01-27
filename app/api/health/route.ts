import { NextResponse } from 'next/server';

export async function GET() {
  // Mock mode when DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: 'ok', db: 'mock' }, { status: 200 });
  }

  try {
    const { db } = await import('@/lib/db');
    // Check DB connection
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'Database disconnected' }, { status: 500 });
  }
}