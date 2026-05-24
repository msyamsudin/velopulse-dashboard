import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config-helper';

export async function GET() {
  const config = getAppConfig();
  const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = `${config.APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 });
  }

  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.heart_rate.write',
    'https://www.googleapis.com/auth/fitness.location.write',
    'https://www.googleapis.com/auth/fitness.body.write',
    'profile',
    'email'
  ];

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes.join(' '))}&` +
    `access_type=offline&` +
    `prompt=consent`;

  return NextResponse.json({ url });
}
