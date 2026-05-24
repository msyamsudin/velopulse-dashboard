import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import axios from 'axios';
import { getAppConfig } from '@/lib/config-helper';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  const config = getAppConfig();
  const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = `${config.APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = response.data;
    
    // Set cookie with tokens
    const cookieStore = await cookies();
    cookieStore.set('google_fit_tokens', JSON.stringify({
      access_token,
      refresh_token,
      expiry_date: Date.now() + expires_in * 1000
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days persistent session
    });

    return new Response(`
      <html>
        <body style="background: #0a0a0a; color: #00ff00; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="text-align: center;">
            <h2>AUTHENTICATION SUCCESSFUL</h2>
            <p>Syncing with Mission Control...</p>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    console.error('Token exchange error:', error.response?.data || error.message);
    return new Response('Authentication failed', { status: 500 });
  }
}
