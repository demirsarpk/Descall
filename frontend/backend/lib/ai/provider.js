"use strict";

/** Shared provider contract. Frontend never sees provider ids. */

const PUBLIC_ASSISTANT_NAME = "Dima 1.0";
const PUBLIC_PRODUCT_NAME = "DimaAI";

/**
 * @typedef {object} ChatMessage
 * @property {"user"|"assistant"} role
 * @property {string} content
 */

/**
 * @typedef {object} ProviderStreamHandlers
 * @property {(chunk: string) => void} onToken
 * @property {() => void} [onDone]
 */

/**
 * @typedef {object} AiProvider
 * @property {string} id internal only
 * @property {(args: { apiKey: string, messages: ChatMessage[], signal?: AbortSignal, onToken?: (s: string) => void }) => Promise<{ text: string }>} complete
 */

module.exports = {
  PUBLIC_ASSISTANT_NAME,
  PUBLIC_PRODUCT_NAME,
};
