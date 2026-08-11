import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web needs absolute asset URLs so deep marketing routes (/faq, /download, …)
// resolve /assets/* correctly. Electron loadFile() still needs relative "./".
const electronBase =
  process.env.ELECTRON_BUILD === "1" || process.env.VITE_BASE === "./";

export default defineConfig({
  plugins: [react()],
  base: electronBase ? "./" : "/",
  publicDir: "public",
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        format: "iife",
      },
    },
    copyPublicDir: true,
  },
});
