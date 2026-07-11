import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    return NextResponse.json({ ok: !!adminDb });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}