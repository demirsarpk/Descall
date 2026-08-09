"use strict";

/**
 * Shared transactional email sender — used by the feedback system, email
 * verification, and 2FA login codes. All of these reuse the same Resend
 * account and FROM address (FEEDBACK_EMAIL_FROM) so there's a single place
 * to configure sender identity.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendEmail(
  { to, subject, text, html },
  { fetchImpl = fetch, env = process.env } = {}
) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.FEEDBACK_EMAIL_FROM;
  if (!apiKey || !from || !to) {
    return { sent: false, skipped: true, error: "Email is not configured" };
  }

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = String(payload?.message || `Resend request failed (${response.status})`).slice(0, 500);
    throw new Error(error);
  }
  return { sent: true, providerId: payload?.id ? String(payload.id).slice(0, 128) : null };
}

/** 6-digit numeric code, safe for display/typing on mobile keyboards. */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeEmailHtml({ title, code, minutes, footer }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;">
    <div style="background:#5865f2;padding:28px 32px;border-radius:16px 16px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Descall</h1>
    </div>
    <div style="background:#fff;border:1px solid #eceef1;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111214;">${title}</h2>
      <p style="color:#4e5058;font-size:14px;line-height:1.5;margin:0 0 24px;">
        ${footer || "Enter this code to continue."}
      </p>
      <div style="background:#f2f3f5;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111214;">${code}</span>
      </div>
      <p style="color:#87898c;font-size:12px;margin:0;">
        This code expires in ${minutes} minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

module.exports = { sendEmail, generateCode, codeEmailHtml };
