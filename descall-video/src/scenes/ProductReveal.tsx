import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText, Subtitle } from "../components/AnimatedText";
import { LightSweep, SoundEffect } from "../components/Transition";

export const ProductReveal: React.FC = () => {
  return (
    <AbsoluteFill>
      <UIZoom
        src="images/frames/app-direct.png"
        zoom={{ start: 1.2, end: 1.06, x: 0.58, y: 0.38 }}
        radius={40}
      />
      <LightSweep at={0} />
      <AnimatedText text="Meet Descall." accentWord="Descall" size={68} bottom={250} delay={4} />
      <Subtitle text="Chat · Voice · LFG" start={18} />
      <Sequence from={0} durationInFrames={20}>
        <SoundEffect file="whoosh" volume={0.32} />
      </Sequence>
      <Sequence from={10} durationInFrames={25}>
        <SoundEffect file="confirm" volume={0.28} />
      </Sequence>
    </AbsoluteFill>
  );
};
