import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../editPlan";

export const BrandBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, 40], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 900px at ${50 + drift * 0.1}% ${30 - drift * 0.05}%, #1a1440 0%, ${BRAND.bg} 55%, #030208 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(700px 500px at 80% 85%, rgba(123,140,255,0.18), transparent 60%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(600px 480px at 15% 70%, rgba(192,132,252,0.12), transparent 55%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          transform: `translateY(${drift * 0.25}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const LightSweep: React.FC<{ at?: number }> = ({ at = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 18) return null;
  const x = interpolate(local, [0, 18], [-40, 140]);
  const opacity = interpolate(local, [0, 4, 14, 18], [0, 0.35, 0.2, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${x}%`,
          width: "28%",
          transform: "skewX(-18deg)",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          filter: "blur(8px)",
        }}
      />
    </AbsoluteFill>
  );
};

export const WhipTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const blur = interpolate(frame, [0, 4, durationInFrames - 4, durationInFrames], [0, 14, 14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const skew = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [0, 8, 0]);
  const opacity = interpolate(frame, [0, 3, durationInFrames - 3, durationInFrames], [0, 1, 1, 0]);
  return (
    <AbsoluteFill
      style={{
        backdropFilter: `blur(${blur}px)`,
        background: `rgba(7,6,13,${0.25 * opacity})`,
        transform: `skewX(${skew}deg) scale(${1 + 0.04 * opacity})`,
        pointerEvents: "none",
      }}
    />
  );
};

export const SoundEffect: React.FC<{
  file: string;
  volume?: number;
}> = ({ file, volume = 0.35 }) => {
  return <Audio src={staticFile(`audio/${file}.mp3`)} volume={volume} />;
};
