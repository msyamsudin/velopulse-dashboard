import axios from 'axios';
import { getAppConfig } from './config-helper';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface FitPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  value: { fpVal?: number; intVal?: number }[];
}

export const MS_TO_NS = BigInt(1_000_000);
export const ACTIVITY_INDOOR_CYCLING = 17;

export const FIT_TYPES = {
  HEART_RATE: 'com.google.heart_rate.bpm',
  POWER: 'com.google.power.sample',
  CADENCE: 'com.google.cycling.pedaling.cadence',
  SPEED: 'com.google.speed',
  DISTANCE: 'com.google.distance.delta',
  CALORIES: 'com.google.calories.expended',
  ACTIVITY: 'com.google.activity.segment',
  ACTIVE_MINUTES: 'com.google.active_minutes',
  WEIGHT: 'com.google.weight',
};

export class GoogleFitService {
  constructor(private accessToken: string) { }

  async getOrCreateDataSource(dataType: string, streamName: string) {
    try {
      const listRes = await axios.get(
        'https://www.googleapis.com/fitness/v1/users/me/dataSources',
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      const existing = (listRes.data.dataSource || []).find((s: any) =>
        s.dataType?.name === dataType &&
        s.dataStreamName === streamName &&
        s.device?.uid === 'VELOPULSE_PRO_STATION_V1'
      );

      if (existing) return existing.dataStreamId;

      const res = await axios.post(
        'https://www.googleapis.com/fitness/v1/users/me/dataSources',
        {
          dataStreamName: streamName,
          type: 'raw',
          application: { name: 'VeloPulse Pro' },
          dataType: { name: dataType },
          device: {
            manufacturer: 'VeloPulse',
            model: 'Pro Dashboard',
            type: 'unknown',
            uid: 'VELOPULSE_PRO_STATION_V1'
          }
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      return res.data.dataStreamId;
    } catch (e: any) {
      if (e.response?.status === 409) {
        const msg = e.response.data.error.message;
        const match = msg.match(/Data Source: (.*) already exists/);
        if (match && match[1]) return match[1].trim();
      }
      throw e;
    }
  }

  async uploadDataset(dataSourceId: string, points: FitPoint[]) {
    if (points.length === 0) return;

    const minStart = points.reduce((min, p) => BigInt(p.startTimeNanos) < min ? BigInt(p.startTimeNanos) : min, BigInt(points[0].startTimeNanos));
    const maxEnd = points.reduce((max, p) => BigInt(p.endTimeNanos) > max ? BigInt(p.endTimeNanos) : max, BigInt(points[0].endTimeNanos));

    const datasetId = `${minStart}-${maxEnd}`;

    await axios.patch(
      `https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataSourceId}/datasets/${datasetId}`,
      {
        dataSourceId,
        minStartTimeNs: minStart.toString(),
        maxEndTimeNs: maxEnd.toString(),
        point: points
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
  }

  async createSession(sessionId: string, startTime: number, endTime: number) {
    await axios.put(
      `https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionId}`,
      {
        id: sessionId,
        name: "Indoor Cycling via VeloPulse Pro",
        description: "Indoor Cycling Session via VeloPulse Pro",
        startTimeMillis: startTime,
        endTimeMillis: endTime,
        application: { name: "VeloPulse Pro" },
        activityType: ACTIVITY_INDOOR_CYCLING,
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
  }

  static async refreshTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
    const config = getAppConfig();
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });

    const { access_token, expires_in, refresh_token: new_refresh_token } = response.data;

    return {
      access_token,
      refresh_token: new_refresh_token || tokens.refresh_token,
      expiry_date: Date.now() + expires_in * 1000
    };
  }
}
