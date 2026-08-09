"use strict";

const { sendEmail, generateCode, codeEmailHtml } = require("./mailer");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

async function run() {
  // Skips cleanly when unconfigured
  const skipped = await sendEmail({ to: "a@b.com", subject: "x", text: "y" }, { env: {} });
  assert(skipped.skipped === true, "skips when RESEND_API_KEY/FEEDBACK_EMAIL_FROM missing");

  // Sends with correct payload shape when configured
  let capturedUrl = null;
  let capturedBody = null;
  const fakeFetch = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ id: "email_123" }) };
  };
  const result = await sendEmail(
    { to: "user@example.com", subject: "Your code", text: "123456" },
    { fetchImpl: fakeFetch, env: { RESEND_API_KEY: "key", FEEDBACK_EMAIL_FROM: "support@descall.com" } }
  );
  assert(result.sent === true, "sends when configured");
  assert(result.providerId === "email_123", "returns provider id");
  assert(capturedUrl === "https://api.resend.com/emails", "posts to Resend endpoint");
  assert(capturedBody.from === "support@descall.com", "uses FEEDBACK_EMAIL_FROM");
  assert(capturedBody.to[0] === "user@example.com", "targets recipient");

  // Propagates provider errors
  const failFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: "bad request" }) });
  let threw = false;
  try {
    await sendEmail(
      { to: "user@example.com", subject: "x", text: "y" },
      { fetchImpl: failFetch, env: { RESEND_API_KEY: "key", FEEDBACK_EMAIL_FROM: "support@descall.com" } }
    );
  } catch (err) {
    threw = true;
    assert(err.message.includes("bad request"), "surfaces provider error message");
  }
  assert(threw, "throws on non-ok response");

  // generateCode is a 6-digit numeric string in range
  for (let i = 0; i < 50; i += 1) {
    const code = generateCode();
    assert(/^\d{6}$/.test(code), "code is 6 digits: " + code);
    const n = Number(code);
    assert(n >= 100000 && n <= 999999, "code in range: " + code);
  }

  const html = codeEmailHtml({ title: "Verify", code: "424242", minutes: 10 });
  assert(html.includes("424242"), "html embeds the code");
  assert(html.includes("10 minutes"), "html embeds expiry");

  console.log("mailer.selftest.cjs: ok");
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
