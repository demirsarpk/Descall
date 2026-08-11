import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { CaptionLines } from "../components/CaptionLines";
import { SoftTransition, SoundEffect } from "../components/Transition";
import { EDIT_PLAN } from "../editPlan";

const scene = EDIT_PLAN[1];

export const ProductReveal: React.FC = () => {
  return (
    <AbsoluteFill>
      <UIZoom src={`images/frames/${scene.frame}.png`} mode="card" />
      <CaptionLines lines={scene.lines} sceneDuration={scene.duration} size={48} />
      <SoftTransition side="in" length={8} />
      <SoftTransition side="out" length={8} />
      <Sequence from={0} durationInFrames={12}>
        <SoundEffect file="whoosh" volume={0.16} />
      </Sequence>
      <Sequence from={8} durationInFrames={18}>
        <SoundEffect file="confirm" volume={0.18} />
      </Sequence>
    </AbsoluteFill>
  );
};
