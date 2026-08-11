import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { CaptionLines } from "../components/CaptionLines";
import { SoftTransition, SoundEffect } from "../components/Transition";
import { EDIT_PLAN } from "../editPlan";

const scene = EDIT_PLAN[0];

export const Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <UIZoom src={`images/frames/${scene.frame}.png`} mode="float" />
      <CaptionLines lines={scene.lines} sceneDuration={scene.duration} size={50} />
      <SoftTransition side="out" length={8} />
      <Sequence from={0} durationInFrames={14}>
        <SoundEffect file="impact" volume={0.28} />
      </Sequence>
      <Sequence from={4} durationInFrames={14}>
        <SoundEffect file="whoosh" volume={0.16} />
      </Sequence>
    </AbsoluteFill>
  );
};
