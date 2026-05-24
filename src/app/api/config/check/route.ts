import { NextResponse } from 'next/server';
import { isSystemConfigured } from '@/lib/config-helper';

export async function GET() {
  try {
    const status = isSystemConfigured();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to check system status' }, { status: 500 });
  }
}
