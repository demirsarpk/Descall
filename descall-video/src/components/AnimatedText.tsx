import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../editPlan";

export const AnimatedText: React.FC<{
  text: string;
  accentWord?: string;
  size?: number;
  bottom?: number;
  delay?: number;
}> = ({ text, accentWord, size = 64, bottom = 220, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottom,
        paddingLeft: 48,
        paddingRight: 48,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.42em",
          rowGap: "0.18em",
          maxWidth: 920,
          padding: "18px 28px",
          borderRadius: 28,
          background: "linear-gradient(180deg, rgba(6,5,14,0.18), rgba(6,5,14,0.55))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {words.map((word, i) => {
          const local = Math.max(0, frame - delay - i * 2);
          const s = spring({
            frame: local,
            fps,
            config: { damping: 16, stiffness: 160, mass: 0.6 },
          });
          const y = interpolate(s, [0, 1], [22, 0]);
          const op = interpolate(s, [0, 1], [0, 1]);
          const clean = word.replace(/[.,!]/g, "");
          const isAccent =
            accentWord &&
            clean.toLowerCase() === accentWord.replace(/[.,!]/g, "").toLowerCase();

          return (
            <span
              key={`${word}-${i}`}
              style={{
                fontFamily: "Inter, Geist, SF Pro Display, Helvetica Neue, sans-serif",
                fontWeight: 750,
                fontSize: size,
                letterSpacing: -1.1,
                lineHeight: 1.12,
                color: isAccent ? BRAND.accent : BRAND.text,
                transform: `translateY(${y}px) scale(${interpolate(s, [0, 1], [0.92, 1])})`,
                opacity: op,
                textShadow: "0 12px 36px rgba(0,0,0,0.75)",
                whiteSpace: "pre",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Subtitle: React.FC<{
  text: string;
  start?: number;
}> = ({ text, start = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - start);
  const s = spring({ frame: local, fps, config: { damping: 18, stiffness: 140 } });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 160,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [12, 0])}px)`,
          background: "rgba(8,6,16,0.55)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          padding: "14px 28px",
          color: BRAND.muted,
          fontFamily: "Inter, Geist, sans-serif",
          fontWeight: 560,
          fontSize: 28,
          letterSpacing: 0.2,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
