import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

export { BrandBackdrop } from "./Effects";
export { SoftTransition, AccentRing, FeatureChip, ScenePips, SparkDust } from "./Effects";

export const LightSweep: React.FC<{ at?: number }> = ({ at = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 22) return null;
  const x = interpolate(local, [0, 22], [-30, 130], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const opacity = interpolate(local, [0, 5, 16, 22], [0, 0.28, 0.16, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          bottom: "-10%",
          left: `${x}%`,
          width: "22%",
          transform: "skewX(-16deg)",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
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
