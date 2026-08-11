import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText } from "../components/AnimatedText";
import {
  AccentRing,
  FeatureChip,
  LightSweep,
  SoftTransition,
  SoundEffect,
  SparkDust,
} from "../components/Transition";

export const Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <AccentRing />
      <UIZoom
        src="images/frames/app-open-dm.png"
        mode="float"
        camera={{
          scaleFrom: 1.04,
          scaleTo: 1.08,
          x: 0.52,
          y: 0.4,
          panX: 8,
          panY: 12,
        }}
      />
      <SparkDust />
      <FeatureChip label="DesCoin" x={70} y={220} delay={10} />
      <FeatureChip label="GIF · Calls" x={680} y={1480} delay={16} />
      <LightSweep at={3} />
      <AnimatedText
        text="Discord, but different."
        accentWord="different"
        size={54}
        bottom={250}
        delay={8}
      />
      <SoftTransition side="out" length={10} />
      <Sequence from={0} durationInFrames={18}>
        <SoundEffect file="impact" volume={0.38} />
      </Sequence>
      <Sequence from={5} durationInFrames={18}>
        <SoundEffect file="whoosh" volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
