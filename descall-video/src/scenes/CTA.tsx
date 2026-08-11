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
import { SoundEffect } from "../components/Transition";
import { BRAND } from "../editPlan";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const logoScale = interpolate(s, [0, 1], [0.7, 1]);
  const glow = interpolate(frame, [0, 40, 90], [0.2, 0.55, 0.35], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(900px 700px at 50% 40%, #1b1538 0%, ${BRAND.bg} 60%, #020108 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(123,140,255,${glow}), transparent 70%)`,
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: s,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Img
          src={staticFile("images/descall-logo.png")}
          style={{
            width: 220,
            height: 220,
            borderRadius: 48,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        />
        <div
          style={{
            fontFamily: "Inter, Geist, sans-serif",
            fontWeight: 800,
            fontSize: 92,
            letterSpacing: -2.5,
            color: BRAND.text,
          }}
        >
          DESCALL
        </div>
      </div>
      <AnimatedText text="Start free at descall.com" accentWord="descall.com" size={40} bottom={280} delay={12} />
      <Sequence from={0} durationInFrames={25}>
        <SoundEffect file="impact" volume={0.4} />
      </Sequence>
      <Sequence from={8} durationInFrames={30}>
        <SoundEffect file="confirm" volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => <CTA />;
