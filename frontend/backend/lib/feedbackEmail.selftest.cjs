const assert = require("node:assert/strict");
const { feedbackEmailContent, sendFeedbackEmail } = require("./feedbackEmail");

const feedback = {
  id: "feedback-1",
  user_id: "user-1",
  username: "tester",
  category: "bug",
  priority: "high",
  subject: "Audio issue",
  message: "Remote audio is missing.",
  platform: "web",
  app_version: "2.6.2",
  created_at: "2026-08-08T20:00:00.000Z",
  attachments: ["https://example.test/screenshot.png"],
};

const text = feedbackEmailContent(feedback);
assert.match(text, /Remote audio is missing/);
assert.match(text, /screenshot\.png/);

let request;
sendFeedbackEmail(feedback, {
  env: {
    RESEND_API_KEY: "test-key",
    FEEDBACK_EMAIL_TO: "support@descall.com",
    FEEDBACK_EMAIL_FROM: "support@descall.com",
  },
  fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: "email-123" }) };
  },
}).then((result) => {
  assert.equal(result.sent, true);
  assert.equal(result.providerId, "email-123");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.to[0], "support@descall.com");
  assert.match(body.subject, /^\[Feedback\]\[bug\] Audio issue$/);
  console.log("feedbackEmail.selftest.cjs: ok");
});
