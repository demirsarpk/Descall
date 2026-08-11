import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom, CameraMove } from "../components/UIZoom";
import { AnimatedText } from "../components/AnimatedText";
import {
  AccentRing,
  FeatureChip,
  LightSweep,
  SoftTransition,
  SoundEffect,
  SparkDust,
} from "../components/Transition";

export const FeatureScene: React.FC<{
  src: string;
  copy: string;
  accent?: string;
  camera?: CameraMove;
  chips?: Array<{ label: string; x: number; y: number; delay?: number }>;
  mode?: "card" | "float" | "full";
}> = ({ src, copy, accent, camera, chips = [], mode = "card" }) => {
  return (
    <AbsoluteFill>
      <AccentRing delay={1} />
      <UIZoom
        src={src}
        mode={mode}
        camera={
          camera ?? {
            scaleFrom: 1.02,
            scaleTo: 1.06,
            x: 0.5,
            y: 0.4,
            panX: 6,
            panY: 10,
          }
        }
      />
      <SparkDust />
      {chips.map((c) => (
        <FeatureChip key={c.label + c.x} {...c} />
      ))}
      <LightSweep at={2} />
      <AnimatedText
        text={copy}
        accentWord={accent}
        size={52}
        bottom={240}
        delay={4}
      />
      <SoftTransition side="in" length={8} />
      <SoftTransition side="out" length={10} />
      <Sequence from={0} durationInFrames={14}>
        <SoundEffect file="whoosh" volume={0.2} />
      </Sequence>
      <Sequence from={8} durationInFrames={10}>
        <SoundEffect file="click" volume={0.16} />
      </Sequence>
    </AbsoluteFill>
  );
};
