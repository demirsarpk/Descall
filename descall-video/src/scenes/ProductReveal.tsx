import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText, Subtitle } from "../components/AnimatedText";
import {
  AccentRing,
  EffectStack,
  FeatureChip,
  LightSweep,
  SoftTransition,
  SoundEffect,
} from "../components/Transition";

export const ProductReveal: React.FC = () => {
  return (
    <AbsoluteFill>
      <AccentRing delay={2} />
      <UIZoom src="images/frames/app-direct.png" mode="card" />
      <EffectStack />
      <FeatureChip label="Realtime" x={80} y={260} delay={10} />
      <FeatureChip label="Voice + Video" x={640} y={1420} delay={16} />
      <LightSweep at={1} />
      <LightSweep at={20} />
      <AnimatedText
        text="Meet Descall."
        accentWord="Descall"
        size={66}
        bottom={260}
        delay={4}
      />
      <Subtitle text="Chat · Voice · LFG" start={16} />
      <SoftTransition side="in" length={8} />
      <SoftTransition side="out" length={10} />
      <Sequence from={0} durationInFrames={16}>
        <SoundEffect file="whoosh" volume={0.24} />
      </Sequence>
      <Sequence from={10} durationInFrames={24}>
        <SoundEffect file="confirm" volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
