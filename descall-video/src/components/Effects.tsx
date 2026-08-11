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

/** Soft floating orbs — subtle only */
export const AmbientOrbs: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const orbs = [
    { x: 18, y: 22, s: 320, c: "rgba(139,155,255,0.14)" },
    { x: 82, y: 70, s: 380, c: "rgba(208,164,255,0.1)" },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {orbs.map((o, i) => {
        const dx = Math.sin(t * 0.35 + i) * 12 * intensity;
        const dy = Math.cos(t * 0.28 + i) * 10 * intensity;
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
              background: `radial-gradient(circle, ${o.c}, transparent 70%)`,
              transform: `translate(${dx}px, ${dy}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Very light spark dust */
export const SparkDust: React.FC<{ count?: number }> = ({ count = 16 }) => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: count }, (_, i) => i);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((i) => {
        const seed = i * 47;
        const x = (seed * 13) % 100;
        const baseY = (seed * 29) % 100;
        const y = (baseY + ((frame * (0.08 + (i % 4) * 0.02)) % 120)) % 120 - 10;
        const op = 0.12 + (i % 3) * 0.04;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 2,
              height: 2,
              borderRadius: 99,
              background: "#fff",
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const SoftTransition: React.FC<{
  side: "in" | "out";
  length?: number;
}> = ({ side, length = 10 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const local = side === "in" ? frame : frame - (durationInFrames - length);
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
        background: `rgba(5,4,10,${0.45 * p})`,
      }}
    />
  );
};

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
    config: { damping: 18, stiffness: 120 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(${interpolate(s, [0, 1], [8, 0])}px)`,
        opacity: s * 0.92,
        padding: "12px 18px",
        borderRadius: 999,
        background: "rgba(12,10,24,0.72)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        fontFamily: "Inter, Geist, sans-serif",
        fontWeight: 620,
        fontSize: 24,
      }}
    >
      {label}
    </div>
  );
};

export const ScenePips: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 52,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 22 : 7,
              height: 7,
              borderRadius: 99,
              background: i === index ? BRAND.accent : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Intentionally empty — flashy FX removed */
export const EffectStack: React.FC<{ heavy?: boolean }> = () => null;

export const BrandBackdrop: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1100px 900px at 50% 30%, #16122e 0%, ${BRAND.bg} 58%, #010105 100%)`,
      }}
    >
      <AmbientOrbs intensity={0.8} />
      <SparkDust count={14} />
    </AbsoluteFill>
  );
};

// Stubs kept so old imports don't break
export const AccentRing: React.FC<{ delay?: number }> = () => null;
export const ConfettiBurst: React.FC<{ delay?: number }> = () => null;
export const PulseRings: React.FC<{ delay?: number }> = () => null;
export const LightBeams: React.FC = () => null;
export const GeoShapes: React.FC = () => null;
export const OrbitDots: React.FC = () => null;
export const EnergyStreak: React.FC<{ at?: number }> = () => null;
export const BeatFlash: React.FC = () => null;
export const HudCorners: React.FC = () => null;
export const Scanlines: React.FC = () => null;
