import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText } from "../components/AnimatedText";
import {
  AccentRing,
  EffectStack,
  FeatureChip,
  LightSweep,
  SoftTransition,
  SoundEffect,
} from "../components/Transition";

export const Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <AccentRing />
      <UIZoom src="images/frames/app-open-dm.png" mode="float" />
      <EffectStack heavy />
      <FeatureChip label="DesCoin" x={70} y={220} delay={8} />
      <FeatureChip label="GIF · Calls" x={680} y={1480} delay={14} />
      <FeatureChip label="Neon Ring" x={720} y={320} delay={18} />
      <LightSweep at={2} />
      <LightSweep at={14} />
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
      <Sequence from={4} durationInFrames={18}>
        <SoundEffect file="whoosh" volume={0.22} />
      </Sequence>
      <Sequence from={0} durationInFrames={30}>
        <SoundEffect file="riser" volume={0.1} />
      </Sequence>
    </AbsoluteFill>
  );
};
