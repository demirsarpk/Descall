import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

export {
  BrandBackdrop,
  SoftTransition,
  AccentRing,
  FeatureChip,
  ScenePips,
  SparkDust,
  EffectStack,
  ConfettiBurst,
  PulseRings,
  LightBeams,
  GeoShapes,
  OrbitDots,
  EnergyStreak,
  BeatFlash,
  HudCorners,
  Scanlines,
  AmbientOrbs,
} from "./Effects";

export const LightSweep: React.FC<{ at?: number }> = ({ at = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 24) return null;
  const x = interpolate(local, [0, 24], [-35, 135], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const opacity = interpolate(local, [0, 5, 18, 24], [0, 0.42, 0.22, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          bottom: "-10%",
          left: `${x}%`,
          width: "26%",
          transform: "skewX(-16deg)",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), rgba(139,155,255,0.2), transparent)",
          filter: "blur(10px)",
        }}
      />
    </AbsoluteFill>
  );
};

export const SoundEffect: React.FC<{
  file: string;
  volume?: number;
}> = ({ file, volume = 0.28 }) => {
  return <Audio src={staticFile(`audio/${file}.mp3`)} volume={volume} />;
};
