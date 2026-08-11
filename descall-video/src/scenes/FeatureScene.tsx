import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { CaptionLines, CaptionLine } from "../components/CaptionLines";
import { SoftTransition, SoundEffect } from "../components/Transition";

export const FeatureScene: React.FC<{
  src: string;
  lines: readonly CaptionLine[];
  duration: number;
  mode?: "card" | "float" | "full";
}> = ({ src, lines, duration, mode = "card" }) => {
  return (
    <AbsoluteFill>
      <UIZoom src={src} mode={mode} />
      <CaptionLines lines={lines} sceneDuration={duration} size={46} />
      <SoftTransition side="in" length={8} />
      <SoftTransition side="out" length={8} />
      <Sequence from={0} durationInFrames={12}>
        <SoundEffect file="whoosh" volume={0.14} />
      </Sequence>
      <Sequence from={6} durationInFrames={8}>
        <SoundEffect file="click" volume={0.12} />
      </Sequence>
    </AbsoluteFill>
  );
};
