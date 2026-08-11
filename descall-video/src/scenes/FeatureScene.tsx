import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { UIZoom } from "../components/UIZoom";
import { AnimatedText } from "../components/AnimatedText";
import { LightSweep, SoundEffect } from "../components/Transition";

export const FeatureScene: React.FC<{
  src: string;
  copy: string;
  accent?: string;
  zoom: { start: number; end: number; x: number; y: number };
  subtitle?: string;
}> = ({ src, copy, accent, zoom, subtitle }) => {
  return (
    <AbsoluteFill>
      <UIZoom src={src} zoom={zoom} radius={40} />
      <LightSweep at={1} />
      <AnimatedText text={copy} accentWord={accent} size={56} bottom={230} delay={3} />
      {subtitle ? (
        <AnimatedText text={subtitle} size={28} bottom={150} delay={14} />
      ) : null}
      <Sequence from={0} durationInFrames={18}>
        <SoundEffect file="whoosh" volume={0.28} />
      </Sequence>
      <Sequence from={8} durationInFrames={12}>
        <SoundEffect file="click" volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
