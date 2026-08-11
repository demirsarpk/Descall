import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText } from "../components/AnimatedText";
import { LightSweep, SoundEffect } from "../components/Transition";

export const Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <UIZoom
        src="images/frames/app-open-dm.png"
        zoom={{ start: 1.42, end: 1.18, x: 0.52, y: 0.4 }}
        radius={40}
      />
      <LightSweep at={2} />
      <AnimatedText text="Discord, but different." accentWord="different." size={58} bottom={240} delay={8} />
      <Sequence from={0} durationInFrames={20}>
        <SoundEffect file="impact" volume={0.45} />
      </Sequence>
      <Sequence from={4} durationInFrames={20}>
        <SoundEffect file="whoosh" volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};
