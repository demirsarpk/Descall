/**
 * Legacy stub — the packaged Electron app uses `main.cjs`.
 * Kept only so accidental `electron main.js` invocations fail loudly.
 */
console.error(
  '[Descall] electron/main.js is a legacy stub. Use electron/main.cjs (see package.json "main").'
);
process.exit(1);
