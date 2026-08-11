import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../editPlan";

/** Soft floating orbs / depth layer */
export const AmbientOrbs: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const orbs = [
    { x: 18, y: 22, s: 340, c: "rgba(139,155,255,0.22)" },
    { x: 82, y: 70, s: 420, c: "rgba(208,164,255,0.16)" },
    { x: 50, y: 88, s: 280, c: "rgba(99,200,255,0.10)" },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {orbs.map((o, i) => {
        const dx = Math.sin(t * 0.45 + i) * 18 * intensity;
        const dy = Math.cos(t * 0.35 + i * 1.3) * 14 * intensity;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: o.s,
              height: o.s,
              marginLeft: -o.s / 2,
              marginTop: -o.s / 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${o.c}, transparent 68%)`,
              transform: `translate(${dx}px, ${dy}px)`,
              filter: "blur(2px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Tiny particle dust */
export const SparkDust: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: 18 }, (_, i) => i);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((i) => {
        const seed = i * 47;
        const x = (seed * 13) % 100;
        const baseY = (seed * 29) % 100;
        const y = (baseY + ((frame * (0.15 + (i % 5) * 0.03)) % 120)) % 120 - 10;
        const op = 0.15 + (i % 4) * 0.05;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: 99,
              background: i % 2 ? BRAND.accent : "#ffffff",
              opacity: op,
              boxShadow: `0 0 10px ${i % 2 ? BRAND.accent : "#fff"}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Soft blur crossfade wipe used at scene edges */
export const SoftTransition: React.FC<{
  side: "in" | "out";
  length?: number;
}> = ({ side, length = 12 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const local =
    side === "in"
      ? frame
      : frame - (durationInFrames - length);
  if (local < 0 || local > length) return null;
  const p = interpolate(local, [0, length], side === "in" ? [1, 0] : [0, 1], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `rgba(5,4,10,${0.55 * p})`,
        backdropFilter: `blur(${10 * p}px)`,
      }}
    />
  );
};

/** Accent ring illustration behind UI */
export const AccentRing: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const spin = interpolate(frame, [0, 300], [0, 35]);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 920,
          height: 920,
          borderRadius: "50%",
          border: "1px solid rgba(139,155,255,0.22)",
          boxShadow:
            "0 0 80px rgba(139,155,255,0.12), inset 0 0 60px rgba(208,164,255,0.08)",
          transform: `scale(${interpolate(s, [0, 1], [0.85, 1])}) rotate(${spin}deg)`,
          opacity: 0.55 * s,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          border: "1px dashed rgba(255,255,255,0.08)",
          transform: `rotate(${-spin * 1.4}deg)`,
          opacity: 0.4 * s,
        }}
      />
    </AbsoluteFill>
  );
};

/** Floating feature chip illustration */
export const FeatureChip: React.FC<{
  label: string;
  x: number;
  y: number;
  delay?: number;
}> = ({ label, x, y, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const float = Math.sin((frame + delay) / 18) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(${float}px) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
        opacity: s,
        padding: "14px 22px",
        borderRadius: 999,
        background: "rgba(12,10,24,0.72)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(16px)",
        color: "#fff",
        fontFamily: "Inter, Geist, sans-serif",
        fontWeight: 650,
        fontSize: 26,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        letterSpacing: -0.3,
      }}
    >
      {label}
    </div>
  );
};

/** Progress pips */
export const ScenePips: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 56,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 28 : 8,
              height: 8,
              borderRadius: 99,
              background:
                i === index ? BRAND.accent : "rgba(255,255,255,0.22)",
              transition: "none",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const BrandBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 720], [0, 28], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1100px 900px at ${48 + drift * 0.08}% 28%, #1a1438 0%, ${BRAND.bg} 58%, #010105 100%)`,
      }}
    >
      <AmbientOrbs />
      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(circle at 50% 40%, black 20%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
};
