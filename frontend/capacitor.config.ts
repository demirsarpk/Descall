import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.descall.app",
  appName: "Descall",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    // WebRTC media APIs require a secure context. Capacitor maps this to its
    // trusted local origin instead of exposing a clear-text web view.
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
