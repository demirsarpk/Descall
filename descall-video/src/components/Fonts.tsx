import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";

let loaded = false;

export const Fonts: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = React.useState(() =>
    loaded ? null : delayRender("Loading Inter fonts")
  );

  React.useEffect(() => {
    if (loaded || !handle) return;
    const style = document.createElement("style");
    style.textContent = `
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Medium.woff2")}') format('woff2');
        font-weight: 500;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-SemiBold.woff2")}') format('woff2');
        font-weight: 600;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Bold.woff2")}') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Bold.woff2")}') format('woff2');
        font-weight: 800;
        font-style: normal;
        font-display: block;
      }
    `;
    document.head.appendChild(style);
    // Wait a tick for fonts
    Promise.all([
      document.fonts.load("700 64px Inter"),
      document.fonts.load("800 92px Inter"),
      document.fonts.load("500 28px Inter"),
    ])
      .catch(() => undefined)
      .finally(() => {
        loaded = true;
        continueRender(handle);
      });
  }, [handle]);

  return <AbsoluteFill>{children}</AbsoluteFill>;
};
