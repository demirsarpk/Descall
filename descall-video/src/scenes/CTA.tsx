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
import { CaptionLines } from "../components/CaptionLines";
import { SoftTransition } from "../components/Effects";
import { SoundEffect } from "../components/Transition";
import { BRAND, EDIT_PLAN } from "../editPlan";

const scene = EDIT_PLAN[6];

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const logoScale = interpolate(s, [0, 1], [0.88, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(900px 720px at 50% 42%, #1b1538 0%, ${BRAND.bg} 62%, #010105 100%)`,
      }}
    >
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: s,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          zIndex: 2,
          marginBottom: 180,
        }}
      >
        <Img
          src={staticFile("images/descall-logo.png")}
          style={{
            width: 180,
            height: 180,
            borderRadius: 44,
            display: "block",
            background: "#0a0814",
            boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
          }}
        />
        <div
          style={{
            fontFamily: "Inter, Geist, sans-serif",
            fontWeight: 800,
            fontSize: 88,
            letterSpacing: -2.4,
            color: BRAND.text,
          }}
        >
          DESCALL
        </div>
      </div>
      <CaptionLines lines={scene.lines} sceneDuration={scene.duration} size={44} bottom={280} />
      <SoftTransition side="in" length={10} />
      <Sequence from={0} durationInFrames={18}>
        <SoundEffect file="impact" volume={0.28} />
      </Sequence>
      <Sequence from={8} durationInFrames={22}>
        <SoundEffect file="confirm" volume={0.2} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => <CTA />;
