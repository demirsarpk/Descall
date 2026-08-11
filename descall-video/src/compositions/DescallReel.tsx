import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { BrandBackdrop, ScenePips } from "../components/Effects";
import { Fonts } from "../components/Fonts";
import { Hook } from "../scenes/Hook";
import { ProductReveal } from "../scenes/ProductReveal";
import { FeatureScene } from "../scenes/FeatureScene";
import { CTA } from "../scenes/CTA";
import { Voiceover, VOICE_CUES } from "../audio/Voiceover";
import { EDIT_PLAN, FPS } from "../editPlan";

const DuckedMusic: React.FC = () => {
  return (
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => {
        const t = f / FPS;
        let vol = 0.3;
        for (const cue of VOICE_CUES) {
          const start = cue.startSec - 0.1;
          const end = cue.startSec + cue.durationSec + 0.15;
          if (t >= start && t <= end) {
            const fade = 0.12;
            const inEdge = Math.min(1, Math.max(0, (t - start) / fade));
            const outEdge = Math.min(1, Math.max(0, (end - t) / fade));
            const gate = Math.min(inEdge, outEdge);
            vol = Math.min(vol, 0.09 + (0.3 - 0.09) * (1 - gate));
          }
        }
        return vol;
      }}
    />
  );
};

const TOTAL = EDIT_PLAN.length;

const sceneById = (id: string, index: number) => {
  const pip = <ScenePips index={index} total={TOTAL} />;
  const scene = EDIT_PLAN[index];
  switch (id) {
    case "hook":
      return (
        <>
          {pip}
          <Hook />
        </>
      );
    case "product":
      return (
        <>
          {pip}
          <ProductReveal />
        </>
      );
    case "feature-chat":
    case "feature-social":
    case "feature-look":
    case "payoff":
      return (
        <>
          {pip}
          <FeatureScene
            src={`images/frames/${scene.frame}.png`}
            lines={scene.lines}
            duration={scene.duration}
            mode={id === "payoff" || id === "feature-chat" ? "float" : "card"}
          />
        </>
      );
    case "cta":
      return (
        <>
          {pip}
          <CTA />
        </>
      );
    default:
      return null;
  }
};

export const DescallReel: React.FC = () => {
  return (
    <Fonts>
      <AbsoluteFill style={{ backgroundColor: "#05040a" }}>
        <BrandBackdrop />
        <DuckedMusic />
        <Voiceover />
        <Series>
          {EDIT_PLAN.map((scene, index) => (
            <Series.Sequence key={scene.id} durationInFrames={scene.duration}>
              <AbsoluteFill>{sceneById(scene.id, index)}</AbsoluteFill>
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>
    </Fonts>
  );
};
