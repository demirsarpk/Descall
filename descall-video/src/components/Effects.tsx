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
    { x: 12, y: 18, s: 380, c: "rgba(139,155,255,0.28)" },
    { x: 88, y: 64, s: 460, c: "rgba(208,164,255,0.2)" },
    { x: 50, y: 90, s: 320, c: "rgba(99,200,255,0.14)" },
    { x: 70, y: 22, s: 240, c: "rgba(255,140,200,0.12)" },
    { x: 28, y: 72, s: 280, c: "rgba(120,255,210,0.1)" },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {orbs.map((o, i) => {
        const dx = Math.sin(t * 0.55 + i * 1.1) * 28 * intensity;
        const dy = Math.cos(t * 0.4 + i * 1.4) * 22 * intensity;
        const pulse = 1 + Math.sin(t * 1.2 + i) * 0.06;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: o.s * pulse,
              height: o.s * pulse,
              marginLeft: (-o.s * pulse) / 2,
              marginTop: (-o.s * pulse) / 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${o.c}, transparent 68%)`,
              transform: `translate(${dx}px, ${dy}px)`,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Dense sparkle / starfield */
export const SparkDust: React.FC<{ count?: number }> = ({ count = 48 }) => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: count }, (_, i) => i);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((i) => {
        const seed = i * 47;
        const x = (seed * 13) % 100;
        const baseY = (seed * 29) % 100;
        const speed = 0.12 + (i % 7) * 0.04;
        const y = (baseY + ((frame * speed) % 130)) % 130 - 10;
        const twinkle = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.25 + i));
        const size = 2 + (i % 4);
        const color = i % 3 === 0 ? BRAND.accent : i % 3 === 1 ? BRAND.accentHot : "#ffffff";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: 99,
              background: color,
              opacity: twinkle,
              boxShadow: `0 0 ${8 + (i % 5) * 2}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const CONFETTI_PIECES = Array.from({ length: 26 }, (_, i) => i);

/** Rising confetti-like shards on scene enter */
export const ConfettiBurst: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  if (local < 0 || local > 40) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {CONFETTI_PIECES.map((i) => {
        const angle = (i / CONFETTI_PIECES.length) * Math.PI * 2;
        const dist = interpolate(local, [0, 40], [0, 280 + (i % 5) * 40], {
          easing: Easing.out(Easing.cubic),
          extrapolateRight: "clamp",
        });
        const op = interpolate(local, [0, 8, 40], [0, 1, 0]);
        const rot = local * (4 + (i % 6)) + i * 20;
        const colors = [BRAND.accent, BRAND.accentHot, "#7ef0d0", "#fff", "#ff9ec8"];
        const c = colors[i % colors.length];
        const x = 540 + Math.cos(angle) * dist;
        const y = 960 + Math.sin(angle) * dist * 0.85;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 10 + (i % 4) * 3,
              height: 6 + (i % 3) * 2,
              borderRadius: 3,
              background: c,
              opacity: op,
              transform: `rotate(${rot}deg)`,
              boxShadow: `0 0 12px ${c}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Expanding pulse rings (does not crop UI) */
export const PulseRings: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {[0, 1, 2, 3].map((i) => {
        const local = (frame - delay + i * 18) % 72;
        const s = interpolate(local, [0, 72], [0.55, 1.35]);
        const op = interpolate(local, [0, 12, 72], [0, 0.45, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              border: `2px solid ${i % 2 ? BRAND.accent : BRAND.accentHot}`,
              transform: `scale(${s})`,
              opacity: op,
              boxShadow: `0 0 30px ${i % 2 ? "rgba(139,155,255,0.35)" : "rgba(208,164,255,0.3)"}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Diagonal light beams */
export const LightBeams: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 12;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: 0.35 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${10 + i * 28 + drift}%`,
            top: "-20%",
            width: 90,
            height: "140%",
            transform: `rotate(${18 + i * 6}deg)`,
            background:
              "linear-gradient(180deg, transparent, rgba(139,155,255,0.18), transparent)",
            filter: "blur(8px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Soft scanlines overlay */
export const Scanlines: React.FC = () => {
  const frame = useCurrentFrame();
  const offset = (frame * 2) % 8;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.08,
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)",
        backgroundPosition: `0 ${offset}px`,
      }}
    />
  );
};

/** Beat flash every ~18 frames */
export const BeatFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = 18;
  const local = frame % beat;
  const flash = interpolate(local, [0, 3, 8], [0.22, 0.08, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(circle at 50% 40%, rgba(139,155,255,${flash}), transparent 55%)`,
      }}
    />
  );
};

const GEO_SHAPES = Array.from({ length: 14 }, (_, i) => ({
  i,
  x: (i * 73) % 100,
  y: (i * 41) % 100,
  size: 18 + (i % 5) * 10,
  kind: i % 3,
}));

/** Floating geometric shapes */
export const GeoShapes: React.FC = () => {
  const frame = useCurrentFrame();
  const shapes = GEO_SHAPES;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {shapes.map((s) => {
        const dx = Math.sin(frame / 28 + s.i) * 16;
        const dy = Math.cos(frame / 34 + s.i * 0.7) * 20;
        const rot = frame * 0.6 + s.i * 25;
        const op = 0.18 + (s.i % 4) * 0.04;
        const common = {
          position: "absolute" as const,
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: s.size,
          height: s.size,
          opacity: op,
          transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
          border: `1.5px solid ${s.i % 2 ? BRAND.accent : BRAND.accentHot}`,
          boxShadow: `0 0 16px ${s.i % 2 ? "rgba(139,155,255,0.35)" : "rgba(208,164,255,0.3)"}`,
        };
        if (s.kind === 0) {
          return <div key={s.i} style={{ ...common, borderRadius: "50%" }} />;
        }
        if (s.kind === 1) {
          return <div key={s.i} style={{ ...common, borderRadius: 6 }} />;
        }
        return (
          <div
            key={s.i}
            style={{
              ...common,
              width: 0,
              height: 0,
              border: "none",
              borderLeft: `${s.size / 2}px solid transparent`,
              borderRight: `${s.size / 2}px solid transparent`,
              borderBottom: `${s.size}px solid ${s.i % 2 ? BRAND.accent : BRAND.accentHot}`,
              background: "transparent",
              boxShadow: "none",
              opacity: op * 0.7,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Orbiting neon dots around center */
export const OrbitDots: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (frame / 40) * Math.PI * 2 + (i / 8) * Math.PI * 2;
        const r = 420 + Math.sin(frame / 20 + i) * 20;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.92;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              borderRadius: 99,
              background: i % 2 ? BRAND.accent : BRAND.accentHot,
              transform: `translate(${x}px, ${y}px)`,
              boxShadow: `0 0 18px ${i % 2 ? BRAND.accent : BRAND.accentHot}`,
              opacity: 0.75,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Horizontal energy streak */
export const EnergyStreak: React.FC<{ at?: number }> = ({ at = 6 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 20) return null;
  const x = interpolate(local, [0, 20], [-30, 120], {
    easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  });
  const op = interpolate(local, [0, 4, 16, 20], [0, 0.85, 0.5, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: op }}>
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: `${x}%`,
          width: "40%",
          height: 6,
          borderRadius: 99,
          background:
            "linear-gradient(90deg, transparent, #8b9bff, #d0a4ff, #7ef0d0, transparent)",
          boxShadow: "0 0 28px rgba(139,155,255,0.8)",
          filter: "blur(1px)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Corner brackets / HUD frame */
export const HudCorners: React.FC = () => {
  const frame = useCurrentFrame();
  const op = 0.35 + 0.15 * Math.sin(frame / 16);
  const arm = 54;
  const thick = 3;
  const color = "rgba(139,155,255,0.75)";
  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: arm,
    height: arm,
    borderColor: color,
    borderStyle: "solid",
    opacity: op,
    boxShadow: `0 0 12px rgba(139,155,255,0.4)`,
    ...pos,
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", padding: 28 }}>
      <div style={corner({ top: 0, left: 0, borderWidth: `${thick}px 0 0 ${thick}px`, borderRadius: "12px 0 0 0" })} />
      <div style={corner({ top: 0, right: 0, borderWidth: `${thick}px ${thick}px 0 0`, borderRadius: "0 12px 0 0" })} />
      <div style={corner({ bottom: 0, left: 0, borderWidth: `0 0 ${thick}px ${thick}px`, borderRadius: "0 0 0 12px" })} />
      <div style={corner({ bottom: 0, right: 0, borderWidth: `0 ${thick}px ${thick}px 0`, borderRadius: "0 0 12px 0" })} />
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
    side === "in" ? frame : frame - (durationInFrames - length);
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
  const spin = interpolate(frame, [0, 300], [0, 80]);
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
          width: 940,
          height: 940,
          borderRadius: "50%",
          border: "2px solid transparent",
          backgroundImage:
            "linear-gradient(#05040a, #05040a), linear-gradient(120deg, #8b9bff, #d0a4ff, #7ef0d0, #8b9bff)",
          backgroundOrigin: "border-box",
          backgroundClip: "content-box, border-box",
          transform: `scale(${interpolate(s, [0, 1], [0.88, 1])}) rotate(${spin}deg)`,
          opacity: 0.55 * s,
          boxShadow: "0 0 90px rgba(139,155,255,0.2)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 780,
          height: 780,
          borderRadius: "50%",
          border: "1px dashed rgba(255,255,255,0.12)",
          transform: `rotate(${-spin * 1.5}deg)`,
          opacity: 0.45 * s,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: "1px solid rgba(208,164,255,0.18)",
          transform: `rotate(${spin * 0.6}deg)`,
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
  const float = Math.sin((frame + delay) / 16) * 8;
  const glow = 0.35 + 0.25 * Math.sin(frame / 12 + delay);
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
        background: "rgba(12,10,24,0.78)",
        border: "1px solid rgba(139,155,255,0.45)",
        backdropFilter: "blur(16px)",
        color: "#fff",
        fontFamily: "Inter, Geist, sans-serif",
        fontWeight: 650,
        fontSize: 26,
        boxShadow: `0 16px 40px rgba(0,0,0,0.35), 0 0 ${24 * glow}px rgba(139,155,255,${glow})`,
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
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 10) * 0.08;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 56,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 28 * pulse : 8,
              height: 8,
              borderRadius: 99,
              background:
                i === index ? BRAND.accent : "rgba(255,255,255,0.22)",
              boxShadow:
                i === index ? `0 0 16px ${BRAND.accent}` : undefined,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Full FX stack for scenes — never crops UI */
export const EffectStack: React.FC<{
  heavy?: boolean;
}> = ({ heavy = true }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <LightBeams />
      <GeoShapes />
      <OrbitDots />
      <PulseRings delay={4} />
      <SparkDust count={heavy ? 56 : 32} />
      <ConfettiBurst delay={2} />
      <EnergyStreak at={5} />
      <EnergyStreak at={28} />
      <BeatFlash />
      <HudCorners />
      <Scanlines />
    </AbsoluteFill>
  );
};

export const BrandBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 720], [0, 28], {
    extrapolateRight: "clamp",
  });
  const hueShift = Math.sin(frame / 50) * 8;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1100px 900px at ${48 + drift * 0.08}% ${28 + hueShift * 0.2}%, #1a1438 0%, ${BRAND.bg} 58%, #010105 100%)`,
      }}
    >
      <AmbientOrbs intensity={1.25} />
      <AbsoluteFill
        style={{
          opacity: 0.14,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(circle at 50% 40%, black 20%, transparent 75%)",
          transform: `translateY(${Math.sin(frame / 40) * 6}px)`,
        }}
      />
      <SparkDust count={36} />
    </AbsoluteFill>
  );
};
