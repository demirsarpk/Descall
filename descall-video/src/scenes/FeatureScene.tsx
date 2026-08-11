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

export const FeatureScene: React.FC<{
  src: string;
  copy: string;
  accent?: string;
  chips?: Array<{ label: string; x: number; y: number; delay?: number }>;
  mode?: "card" | "float" | "full";
}> = ({ src, copy, accent, chips = [], mode = "card" }) => {
  return (
    <AbsoluteFill>
      <AccentRing delay={1} />
      <UIZoom src={src} mode={mode} />
      <EffectStack />
      {chips.map((c) => (
        <FeatureChip key={c.label + c.x} {...c} />
      ))}
      <LightSweep at={2} />
      <LightSweep at={18} />
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
      <Sequence from={2} durationInFrames={20}>
        <SoundEffect file="impact" volume={0.12} />
      </Sequence>
    </AbsoluteFill>
  );
};
