import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AnimatedText } from "../components/AnimatedText";
import {
  AccentRing,
  AmbientOrbs,
  ConfettiBurst,
  EffectStack,
  SoftTransition,
} from "../components/Effects";
import { SoundEffect } from "../components/Transition";
import { BRAND } from "../editPlan";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const logoScale = interpolate(s, [0, 1], [0.82, 1]);
  const glow = interpolate(frame, [0, 50, 140], [0.22, 0.65, 0.4], {
    extrapolateRight: "clamp",
  });
  const ringPulse = 1 + Math.sin(frame / 12) * 0.035;
  const spin = (frame * 2) % 360;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(900px 720px at 50% 42%, #1b1538 0%, ${BRAND.bg} 62%, #010105 100%)`,
      }}
    >
      <AmbientOrbs intensity={1.5} />
      <AccentRing />
      <EffectStack heavy />
      <ConfettiBurst delay={4} />
      <ConfettiBurst delay={22} />
      <div
        style={{
          position: "absolute",
          width: 620 * ringPulse,
          height: 620 * ringPulse,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(139,155,255,${glow}), transparent 70%)`,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: `conic-gradient(from ${spin}deg, #8b9bff, #d0a4ff, #7ef0d0, #8b9bff)`,
          filter: "blur(20px)",
          opacity: 0.45,
        }}
      />
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: s,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
          zIndex: 2,
        }}
      >
        <div
          style={{
            padding: 7,
            borderRadius: 58,
            background: `conic-gradient(from ${spin}deg, #8b9bff, #d0a4ff, #7ef0d0, #ff9ec8, #8b9bff)`,
            boxShadow: `0 40px 100px rgba(0,0,0,0.45), 0 0 ${50 * glow}px rgba(139,155,255,0.55)`,
          }}
        >
          <Img
            src={staticFile("images/descall-logo.png")}
            style={{
              width: 200,
              height: 200,
              borderRadius: 50,
              display: "block",
              background: "#0a0814",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: "Inter, Geist, sans-serif",
            fontWeight: 820,
            fontSize: 96,
            letterSpacing: -2.8,
            color: BRAND.text,
            textShadow: `0 0 40px rgba(139,155,255,0.55), 0 0 80px rgba(208,164,255,0.35)`,
          }}
        >
          DESCALL
        </div>
      </div>
      <AnimatedText
        text="Start free at descall.com"
        accentWord="descall.com"
        size={38}
        bottom={300}
        delay={14}
        variant="caption"
      />
      <SoftTransition side="in" length={12} />
      <Sequence from={0} durationInFrames={22}>
        <SoundEffect file="impact" volume={0.34} />
      </Sequence>
      <Sequence from={10} durationInFrames={28}>
        <SoundEffect file="confirm" volume={0.24} />
      </Sequence>
      <Sequence from={0} durationInFrames={40}>
        <SoundEffect file="riser" volume={0.14} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => <CTA />;
