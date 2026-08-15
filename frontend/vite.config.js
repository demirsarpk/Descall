import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

// Web needs absolute asset URLs so deep marketing routes (/faq, /download, …)
// resolve /assets/* correctly. Electron loadFile() still needs relative "./".
const electronBase =
  process.env.ELECTRON_BUILD === "1" || process.env.VITE_BASE === "./";

const require = createRequire(import.meta.url);

function resolveOutfit700Woff2() {
  try {
    const outfitCss = require.resolve("@fontsource/outfit/latin-700.css");
    const cssText = fs.readFileSync(outfitCss, "utf8");
    const match = cssText.match(/url\(([^)]+\.woff2)\)/);
    if (!match?.[1]) return null;
    const rel = match[1].replace(/^['"]|['"]$/g, "");
    const fontAbs = path.resolve(path.dirname(outfitCss), rel);
    return fs.existsSync(fontAbs) ? fontAbs : null;
  } catch {
    return null;
  }
}

/**
 * Inject Search Console / Bing verification metas + Outfit 700 preload for LCP
 * (DES-8 / DES-18 / DES-50).
 */
function descallHtmlSeoPlugin() {
  return {
    name: "descall-html-seo",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const tags = [];
        // Optional. Domain-property DNS verification does not need this token.
        const gsc = String(process.env.VITE_GSC_VERIFICATION || "").trim();
        const bing = String(process.env.VITE_BING_SITE_VERIFICATION || "").trim();
        if (gsc) {
          tags.push({
            tag: "meta",
            attrs: { name: "google-site-verification", content: gsc },
            injectTo: "head",
          });
        }
        if (bing) {
          tags.push({
            tag: "meta",
            attrs: { name: "msvalidate.01", content: bing },
            injectTo: "head",
          });
        }

        if (electronBase) return tags;

        let fontHref = null;
        if (ctx.bundle) {
          const fontAsset = Object.values(ctx.bundle).find(
            (item) =>
              item?.type === "asset" &&
              typeof item.fileName === "string" &&
              /outfit-latin-700-normal[^/]*\.woff2$/i.test(item.fileName)
          );
          if (fontAsset) fontHref = `/${fontAsset.fileName}`;
        }
        if (!fontHref && ctx.server) {
          const abs = resolveOutfit700Woff2();
          if (abs) fontHref = `/@fs/${abs}`;
        }
        if (fontHref) {
          tags.push({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              crossorigin: "anonymous",
              href: fontHref,
            },
            injectTo: "head",
          });
        }
        return tags;
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), descallHtmlSeoPlugin()],
  // Serve prerendered dist/<route>/index.html shells in preview (not SPA fallback to /).
  appType: "mpa",
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
                if (id.includes("lucide-react")) return "vendor-icons";
              }
              // Do not force all /src/site into one chunk — route lazy() splits pages.
              return undefined;
            },
          },
    },
    copyPublicDir: true,
  },
});
