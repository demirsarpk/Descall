"use strict";

/**
 * Shared transactional email sender — feedback, email verification,
 * 2FA login codes, and password-reset codes (Resend).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SUPPORT_EMAIL = "support@descall.com";

async function sendEmail(
  { to, subject, text, html, replyTo },
  { fetchImpl = fetch, env = process.env } = {}
) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.FEEDBACK_EMAIL_FROM || env.EMAIL_FROM || "Descall <noreply@descall.com>";
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
      ...(replyTo ? { reply_to: replyTo } : { reply_to: SUPPORT_EMAIL }),
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeDigitsHtml(code) {
  return String(code)
    .split("")
    .map(
      (d) =>
        `<td align="center" bgcolor="#0f1117" style="width:42px;height:52px;border-radius:10px;border:1px solid #2a2f3a;">` +
        `<span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:0;color:#f4f6fb;line-height:52px;">${escapeHtml(d)}</span>` +
        `</td>`
    )
    .join('<td style="width:8px;"></td>');
}

/**
 * Premium branded verification / reset code email (table-based for clients).
 */
function codeEmailHtml({
  title,
  headline,
  code,
  minutes = 10,
  footer,
  username,
  purposeLabel = "Security code",
}) {
  const safeTitle = escapeHtml(title || "Descall");
  const safeHeadline = escapeHtml(headline || title || "Your verification code");
  const safeFooter = escapeHtml(
    footer || "Enter this code in Descall to continue. If you did not request this, you can ignore this email."
  );
  const safeUser = username ? escapeHtml(username) : null;
  const safePurpose = escapeHtml(purposeLabel);
  const digits = codeDigitsHtml(code);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0d12;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0d12" style="background-color:#0b0d12;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="left" style="padding:0 0 18px 4px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9db0ff;">Descall</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="#141821" style="background-color:#141821;border:1px solid #242a36;border-radius:18px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#1a2140" style="background:linear-gradient(135deg,#243056 0%,#1a2140 55%,#141821 100%);background-color:#1a2140;padding:28px 28px 22px;">
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9db0ff;">${safePurpose}</p>
                    <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;">${safeHeadline}</h1>
                    ${
                      safeUser
                        ? `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#c5cad6;">Hi <strong style="color:#ffffff;">@${safeUser}</strong>,</p>`
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c5cad6;">${safeFooter}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
                      <tr>${digits}</tr>
                    </table>
                    <p style="margin:18px 0 0;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:0.35em;color:#8b93a7;">${escapeHtml(code)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                      <tr>
                        <td bgcolor="#0f1117" style="background-color:#0f1117;border:1px solid #242a36;border-radius:12px;padding:14px 16px;">
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#8b93a7;">
                            This code expires in <strong style="color:#e8ebf2;">${Number(minutes) || 10} minutes</strong>.
                            Never share it with anyone. Descall staff will never ask for your code.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#6d7485;">
                Need help? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#9db0ff;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#555b6a;">
                © ${new Date().getUTCFullYear()} Descall · Secure account messaging
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendEmail, generateCode, codeEmailHtml, SUPPORT_EMAIL };
