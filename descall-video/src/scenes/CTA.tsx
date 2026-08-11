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
  SoftTransition,
  SparkDust,
} from "../components/Effects";
import { SoundEffect } from "../components/Transition";
import { BRAND } from "../editPlan";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const logoScale = interpolate(s, [0, 1], [0.82, 1]);
  const glow = interpolate(frame, [0, 50, 140], [0.18, 0.5, 0.32], {
    extrapolateRight: "clamp",
  });
  const ringPulse = 1 + Math.sin(frame / 14) * 0.02;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(900px 720px at 50% 42%, #1b1538 0%, ${BRAND.bg} 62%, #010105 100%)`,
      }}
    >
      <AmbientOrbs intensity={1.2} />
      <AccentRing />
      <SparkDust />
      <div
        style={{
          position: "absolute",
          width: 560 * ringPulse,
          height: 560 * ringPulse,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(139,155,255,${glow}), transparent 70%)`,
          filter: "blur(8px)",
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
            padding: 6,
            borderRadius: 56,
            background:
              "linear-gradient(135deg, rgba(139,155,255,0.7), rgba(208,164,255,0.45))",
            boxShadow: "0 40px 100px rgba(0,0,0,0.45)",
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
            textShadow: "0 0 40px rgba(139,155,255,0.35)",
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
        <SoundEffect file="riser" volume={0.12} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => <CTA />;
