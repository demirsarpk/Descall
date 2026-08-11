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
  variant?: "hero" | "caption";
}> = ({
  text,
  accentWord,
  size = 58,
  bottom = 230,
  delay = 0,
  variant = "hero",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  const plate = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottom,
        paddingLeft: 40,
        paddingRight: 40,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.38em",
          rowGap: "0.12em",
          maxWidth: 940,
          padding: variant === "hero" ? "20px 30px" : "12px 22px",
          borderRadius: variant === "hero" ? 30 : 999,
          background:
            variant === "hero"
              ? "linear-gradient(180deg, rgba(8,6,18,0.25), rgba(8,6,18,0.62))"
              : "rgba(8,6,18,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
          backdropFilter: "blur(14px)",
          transform: `translateY(${interpolate(plate, [0, 1], [16, 0])}px)`,
          opacity: plate,
        }}
      >
        {words.map((word, i) => {
          const local = Math.max(0, frame - delay - 4 - i * 2);
          const s = spring({
            frame: local,
            fps,
            config: { damping: 18, stiffness: 150, mass: 0.55 },
          });
          const clean = word.replace(/[.,!]/g, "");
          const isAccent =
            accentWord &&
            clean.toLowerCase() ===
              accentWord.replace(/[.,!]/g, "").toLowerCase();

          return (
            <span
              key={`${word}-${i}`}
              style={{
                fontFamily:
                  "Inter, Geist, SF Pro Display, Helvetica Neue, sans-serif",
                fontWeight: 740,
                fontSize: size,
                letterSpacing: -1.2,
                lineHeight: 1.12,
                color: isAccent ? BRAND.accent : BRAND.text,
                transform: `translateY(${interpolate(s, [0, 1], [18, 0])}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
                opacity: s,
                textShadow: isAccent
                  ? `0 0 28px rgba(139,155,255,0.65), 0 0 60px rgba(208,164,255,0.35), 0 12px 36px rgba(0,0,0,0.7)`
                  : "0 12px 36px rgba(0,0,0,0.7)",
                whiteSpace: "pre",
                backgroundImage: isAccent
                  ? "linear-gradient(90deg, #8b9bff, #d0a4ff, #7ef0d0)"
                  : undefined,
                WebkitBackgroundClip: isAccent ? "text" : undefined,
                WebkitTextFillColor: isAccent ? "transparent" : undefined,
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
        paddingBottom: 150,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)`,
          background: "rgba(8,6,16,0.5)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          padding: "12px 24px",
          color: BRAND.muted,
          fontFamily: "Inter, Geist, sans-serif",
          fontWeight: 560,
          fontSize: 26,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
