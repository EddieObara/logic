// utils/zoom.js
import fetch from 'node-fetch';

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60_000) return cachedToken;

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;

  const resp = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Zoom token error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

export async function createZoomMeeting({ topic, startTimeISO, durationMinutes = 45 }) {
  const token = await getAccessToken();

  const body = {
    topic,
    type: 2,                     // scheduled
    start_time: startTimeISO,    // ISO8601 UTC, e.g. "2025-09-06T12:30:00Z"
    duration: durationMinutes,
    settings: {
      join_before_host: false,
      waiting_room: true
    }
  };

  const resp = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Zoom create meeting error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return { meetingId: String(data.id), joinUrl: data.join_url };
}
