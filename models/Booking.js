// models/Booking.js
import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  dateISO: { type: Date, required: true },      // meeting start (ISO)
  meetingType: { type: String, enum: ["Zoom", "Google Meet"], required: true },

  // Zoom fields
  zoomMeetingId: { type: String },
  zoomJoinUrl: { type: String },

  // Reminder/Status
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', BookingSchema);
