// utils/mailer.js
import nodemailer from 'nodemailer';

export function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

/**
 * Send confirmation email immediately after booking.
 */
export async function sendConfirmationEmail({ to, name, dateISO, meetingType }) {
  const transport = createTransport();
  const date = new Date(dateISO);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <p>Hi ${name},</p>
      <p>Thanks for booking an appointment with Loop & Logic.</p>
      <p><strong>Date:</strong> ${date.toLocaleDateString()}<br>
         <strong>Time:</strong> ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br>
         <strong>Meeting Type:</strong> ${meetingType}</p>
      <p>We’ll send another email with your unique ${meetingType} link <strong>30 minutes before</strong> the meeting.</p>
      <p>Best regards,<br>Loop & Logic Team</p>
    </div>
  `;

  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: 'Appointment Received — Loop & Logic',
    html
  });
}

/**
 * Send the actual meeting link 30 minutes before.
 */
export async function sendLinkEmail({ to, name, dateISO, meetingType, joinUrl }) {
  const transport = createTransport();
  const date = new Date(dateISO);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <p>Hi ${name},</p>
      <p>Your ${meetingType} call starts in about 30 minutes.</p>
      <p><a href="${joinUrl}" style="display:inline-block;padding:10px 16px;background:#1e3c72;color:#fff;text-decoration:none;border-radius:6px;">Join Meeting</a></p>
      <p><strong>Date:</strong> ${date.toLocaleDateString()}<br>
         <strong>Time:</strong> ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
      <p>See you soon!<br>Loop & Logic Team</p>
    </div>
  `;

  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: 'Your Meeting Link — Loop & Logic',
    html
  });
}
