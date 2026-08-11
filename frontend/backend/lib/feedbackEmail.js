"use strict";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function cleanText(value, maxLength = 4000) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function feedbackEmailContent(feedback) {
  const attachments = Array.isArray(feedback.attachments)
    ? feedback.attachments.filter((url) => typeof url === "string" && url.length <= 2048)
    : [];
  const attachmentBlock = attachments.length
    ? `\nAttachments:\n${attachments.map((url) => `- ${url}`).join("\n")}`
    : "";

  return [
    "New Descall feedback received",
    "",
    `Feedback ID: ${cleanText(feedback.id, 128)}`,
    `User ID: ${cleanText(feedback.user_id, 128)}`,
    `Username: ${cleanText(feedback.username, 128)}`,
    `Category: ${cleanText(feedback.category, 80)}`,
    `Priority: ${cleanText(feedback.priority, 80)}`,
    `Subject: ${cleanText(feedback.subject, 200)}`,
    `Platform: ${cleanText(feedback.platform, 160)}`,
    `App version: ${cleanText(feedback.app_version, 80)}`,
    `Submitted: ${cleanText(feedback.created_at, 80)}`,
    "",
    "Message:",
    cleanText(feedback.message, 10000),
    attachmentBlock,
  ].join("\n");
}

async function sendFeedbackEmail(feedback, { fetchImpl = fetch, env = process.env } = {}) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.FEEDBACK_EMAIL_TO;
  const from = env.FEEDBACK_EMAIL_FROM;
  if (!apiKey || !to || !from) {
    return { sent: false, skipped: true, error: "Feedback email is not configured" };
  }

  const subject = `[Feedback][${cleanText(feedback.category, 80) || "other"}] ${
    cleanText(feedback.subject, 160) || "New feedback"
  }`;
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
      text: feedbackEmailContent(feedback),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = cleanText(payload?.message || `Resend request failed (${response.status})`, 500);
    throw new Error(error);
  }
  return { sent: true, providerId: cleanText(payload?.id, 128) || null };
}

module.exports = { sendFeedbackEmail, feedbackEmailContent };
