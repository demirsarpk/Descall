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
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@sapphi-red/web-noise-suppressor"],
  },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    // Electron's file:// loader historically used IIFE; web builds benefit from
    // ES modules + manual chunks so marketing pages do not download voice WASM first.
    rollupOptions: {
      output: electronBase
        ? { format: "iife" }
        : {
            manualChunks(id) {
              if (id.includes("node_modules")) {
                if (id.includes("livekit")) return "vendor-livekit";
                if (id.includes("framer-motion")) return "vendor-motion";
                if (id.includes("socket.io")) return "vendor-socket";
                if (id.includes("posthog")) return "vendor-analytics";
                if (id.includes("@sapphi-red") || id.includes("rnnoise")) return "vendor-noise";
                if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
              }
              if (id.includes("/src/site/")) return "marketing";
              return undefined;
            },
          },
    },
    copyPublicDir: true,
  },
});
