"use strict";

const assert = require("assert");
const gemini = require("./gemini");

const originalFetch = global.fetch;

function sseResponse(chunks) {
  const payload = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("");
  const bytes = new TextEncoder().encode(payload);
  return {
    ok: true,
    body: {
      getReader() {
        let sent = false;
        return {
          async read() {
            if (sent) return { done: true };
            sent = true;
            return { done: false, value: bytes };
          },
          async cancel() {},
        };
      },
    },
  };
}

async function main() {
  const calls = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url: String(url), body });
    if (String(url).includes("streamGenerateContent")) {
      return sseResponse([
        { candidates: [{ content: { parts: [{ thought: true, text: "hidden reasoning" }] } }] },
      ]);
    }
    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ text: "Merhaba, ben Dima 1.0." }] } }] };
      },
    };
  };

  const tokens = [];
  const result = await gemini.complete({
    apiKey: "test-key",
    messages: [{ role: "user", content: "sen kimsin" }],
    onToken: (piece) => tokens.push(piece),
  });
  assert.equal(result.text, "Merhaba, ben Dima 1.0.");
  assert.equal(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
  assert.ok(calls.some((c) => c.url.includes("generateContent") && !c.url.includes("stream")));
  assert.deepEqual(tokens, ["Merhaba, ben Dima 1.0."]);

  global.fetch = async (url) => {
    if (String(url).includes("streamGenerateContent")) {
      return sseResponse([
        { candidates: [{ content: { parts: [{ thought: true, text: "only thinking" }] } }] },
      ]);
    }
    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ thought: true, text: "still thinking" }] } }] };
      },
    };
  };

  let threw = null;
  try {
    await gemini.complete({
      apiKey: "test-key",
      messages: [{ role: "user", content: "hi" }],
    });
  } catch (err) {
    threw = err;
  }
  assert.equal(threw?.code, "unavailable");
}

main()
  .then(() => {
    global.fetch = originalFetch;
    console.log("gemini complete selftest ok");
  })
  .catch((err) => {
    global.fetch = originalFetch;
    console.error(err);
    process.exit(1);
  });
