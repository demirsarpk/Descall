import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";

export {
  BrandBackdrop,
  SoftTransition,
  AccentRing,
  FeatureChip,
  ScenePips,
  SparkDust,
  EffectStack,
  AmbientOrbs,
} from "./Effects";

export const LightSweep: React.FC<{ at?: number }> = ({ at = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 16) return null;
  const x = interpolate(local, [0, 16], [-20, 120], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const opacity = interpolate(local, [0, 4, 12, 16], [0, 0.18, 0.1, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          bottom: "-10%",
          left: `${x}%`,
          width: "18%",
          transform: "skewX(-14deg)",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
          filter: "blur(8px)",
        }}
      />
    </AbsoluteFill>
  );
};

export const SoundEffect: React.FC<{
  file: string;
  volume?: number;
}> = ({ file, volume = 0.22 }) => {
  return <Audio src={staticFile(`audio/${file}.mp3`)} volume={volume} />;
};
