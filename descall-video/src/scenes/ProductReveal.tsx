import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText, Subtitle } from "../components/AnimatedText";
import {
  AccentRing,
  LightSweep,
  SoftTransition,
  SoundEffect,
} from "../components/Transition";

export const ProductReveal: React.FC = () => {
  return (
    <AbsoluteFill>
      <AccentRing delay={2} />
      <UIZoom
        src="images/frames/app-direct.png"
        mode="card"
        camera={{
          scaleFrom: 1.02,
          scaleTo: 1.06,
          x: 0.58,
          y: 0.38,
          panX: -10,
          panY: 8,
        }}
      />
      <LightSweep at={1} />
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
