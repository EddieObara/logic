// server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import nodeCron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

import Booking from './models/Booking.js';
import { sendConfirmationEmail, sendLinkEmail } from './utils/mailer.js';
import { createZoomMeeting } from './utils/zoom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

// --- Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));

// --- Mongo
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => console.error('MongoDB error:', e));

// --- Simple API key guard
function requireKey(req, res, next) {
  const key = req.header('X-API-KEY');
  if (!API_KEY || key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// --- Health
app.get('/health', (_, res) => res.json({ ok: true }));

// --- Create booking (from your PHP form)
app.post('/api/bookings', requireKey, async (req, res) => {
  try {
    const { name, email, date, time, meeting } = req.body;
    if (!name || !email || !date || !time || !meeting)
      return res.status(400).json({ error: 'Missing fields' });

    // Convert to ISO in UTC (assumes incoming is local date & HH:MM)
    const startLocal = new Date(`${date}T${time}:00`);
    const startISO = new Date(startLocal).toISOString();

    let zoomMeetingId, zoomJoinUrl;

    if (meeting === 'Zoom') {
      // Create the Zoom meeting immediately
      const { meetingId, joinUrl } = await createZoomMeeting({
        topic: `Consultation with ${name}`,
        startTimeISO: startISO
      });
      zoomMeetingId = meetingId;
      zoomJoinUrl = joinUrl;
    }

    const booking = await Booking.create({
      name,
      email,
      dateISO: startISO,
      meetingType: meeting,
      zoomMeetingId,
      zoomJoinUrl
    });

    // Fire confirmation email
    await sendConfirmationEmail({
      to: email,
      name,
      dateISO: startISO,
      meetingType: meeting
    });

    res.json({ success: true, id: booking._id });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Cron job: every minute, send link 30 minutes before start
nodeCron.schedule('* * * * *', async () => {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 60 * 1000);

  try {
    const due = await Booking.find({
      reminderSent: false,
      dateISO: { $lte: in30, $gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // sanity window
    });

    for (const b of due) {
      let joinUrl = b.zoomJoinUrl;

      // If Google Meet route is ever added, generate link here.
      if (!joinUrl && b.meetingType === 'Zoom') {
        const { joinUrl: freshUrl, meetingId } = await createZoomMeeting({
          topic: `Consultation with ${b.name}`,
          startTimeISO: b.dateISO
        });
        b.zoomJoinUrl = freshUrl;
        b.zoomMeetingId = meetingId;
        joinUrl = freshUrl;
      }

      if (!joinUrl) continue; // skip if no link

      await sendLinkEmail({
        to: b.email,
        name: b.name,
        dateISO: b.dateISO,
        meetingType: b.meetingType,
        joinUrl
      });

      b.reminderSent = true;
      await b.save();
    }
  } catch (e) {
    console.error('Cron error:', e.message);
  }
});

// --- (Optional) Serve a simple landing for sanity
app.get('/', (_, res) => res.send('Booking API is live.'));

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
