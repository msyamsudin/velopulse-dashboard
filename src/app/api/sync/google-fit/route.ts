import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleFitService, FIT_TYPES, MS_TO_NS, GoogleTokens } from '@/lib/google-fit-service';
import { mapWorkoutToFitPoints } from '@/lib/mappers/google-fit-mapper';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const tokensCookie = cookieStore.get('google_fit_tokens');

  if (!tokensCookie) {
    return NextResponse.json({ error: 'Not connected to Google Fit' }, { status: 401 });
  }

  let tokens: GoogleTokens;
  try {
    tokens = JSON.parse(tokensCookie.value);
    if (!tokens?.access_token || !tokens?.refresh_token) {
      return NextResponse.json({ error: 'Invalid session structure' }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Refresh token if needed
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 5 * 60 * 1000) {
    try {
      tokens = await GoogleFitService.refreshTokens(tokens);
      cookieStore.set('google_fit_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60
      });
    } catch (refreshError: any) {
      console.error('Failed to refresh token:', refreshError.response?.data || refreshError.message);
      return NextResponse.json({ error: 'Session expired, please reconnect to Google Fit', auth_required: true }, { status: 401 });
    }
  }

  const body = await request.json();
  const { startTime, endTime, history, maxHr = 190, weight } = body;

  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'Invalid request body parameters' }, { status: 400 });
  }

  const gfService = new GoogleFitService(tokens.access_token);

  try {
    const workoutHistory = history || [];
    const actualEndTime = workoutHistory.length > 0 
      ? Math.max(endTime, startTime + (workoutHistory.length * 1000))
      : endTime;

    const sessionId = `velopulse_${startTime}_${crypto.randomUUID().split('-')[0]}`;
    
    // 1. Create Session
    await gfService.createSession(sessionId, startTime, actualEndTime);

    // 2. Map and Upload Metrics
    if (workoutHistory.length > 0) {
      const metrics = mapWorkoutToFitPoints(startTime, actualEndTime, workoutHistory, maxHr);
      
      const uploadResults = await Promise.allSettled(
        Object.entries(metrics).map(async ([key, metric]) => {
          if (metric.points.length > 0) {
            const dsId = await gfService.getOrCreateDataSource(metric.type, key);
            await gfService.uploadDataset(dsId, metric.points);
          }
        })
      );

      const failed = uploadResults.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn(`[Google Fit] ${failed.length} metrics failed to upload.`);
      }
    }

    // 3. Handle Weight Sync
    if (weight && weight > 0) {
      try {
        const weightDsId = await gfService.getOrCreateDataSource(FIT_TYPES.WEIGHT, 'weight');
        const weightPoint = {
          startTimeNanos: (BigInt(actualEndTime) * MS_TO_NS).toString(),
          endTimeNanos: (BigInt(actualEndTime) * MS_TO_NS).toString(),
          dataTypeName: FIT_TYPES.WEIGHT,
          value: [{ fpVal: weight }]
        };
        await gfService.uploadDataset(weightDsId, [weightPoint]);
      } catch (weightError: any) {
        console.error('[Google Fit] Failed to sync weight:', weightError.message);
      }
    }
    
    return NextResponse.json({ success: true, sessionId });
  } catch (error: any) {
    console.error('Sync error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to sync with Google Fit' }, { status: 500 });
  }
}
