"use strict";

const { sendEmail } = require("./mailer");

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
  const to = env.FEEDBACK_EMAIL_TO;
  if (!to) {
    return { sent: false, skipped: true, error: "Feedback email is not configured" };
  }

  const subject = `[Feedback][${cleanText(feedback.category, 80) || "other"}] ${
    cleanText(feedback.subject, 160) || "New feedback"
  }`;
  return sendEmail(
    { to, subject, text: feedbackEmailContent(feedback) },
    { fetchImpl, env }
  );
}

module.exports = { sendFeedbackEmail, feedbackEmailContent };
