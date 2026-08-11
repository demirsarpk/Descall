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

/** Music ducks under voiceover so captions stay intelligible */
const DuckedMusic: React.FC = () => {
  return (
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => {
        const t = f / FPS;
        let vol = 0.34;
        for (const cue of VOICE_CUES) {
          const start = cue.startSec - 0.12;
          const end = cue.startSec + 2.85;
          if (t >= start && t <= end) {
            const fade = 0.15;
            const inEdge = Math.min(1, Math.max(0, (t - start) / fade));
            const outEdge = Math.min(1, Math.max(0, (end - t) / fade));
            const gate = Math.min(inEdge, outEdge);
            // During speech: ~0.10; edges ramp
            vol = Math.min(vol, 0.1 + (0.34 - 0.1) * (1 - gate));
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
      return (
        <>
          {pip}
          <FeatureScene
            src="images/frames/app-open-dm.png"
            copy="Cosmetics that show."
            accent="show"
            mode="float"
            chips={[
              { label: "Neon frame", x: 64, y: 240, delay: 10 },
              { label: "Titles · Badges", x: 620, y: 1480, delay: 16 },
              { label: "DesCoin", x: 740, y: 360, delay: 20 },
              { label: "GIF ready", x: 80, y: 1380, delay: 24 },
            ]}
          />
        </>
      );
    case "feature-social":
      return (
        <>
          {pip}
          <FeatureScene
            src="images/frames/app-friends-2.png"
            copy="Friends. Calls. Done."
            accent="Done"
            chips={[
              { label: "1:1 & groups", x: 80, y: 1360, delay: 10 },
              { label: "HD voice", x: 700, y: 280, delay: 14 },
              { label: "Instant DM", x: 720, y: 1500, delay: 18 },
            ]}
          />
        </>
      );
    case "feature-look":
      return (
        <>
          {pip}
          <FeatureScene
            src="images/frames/app-appearance.png"
            copy="Make it yours."
            accent="yours"
            chips={[
              { label: "Themes", x: 720, y: 240, delay: 10 },
              { label: "Profile FX", x: 60, y: 1480, delay: 16 },
              { label: "Accent color", x: 680, y: 1400, delay: 20 },
            ]}
          />
        </>
      );
    case "payoff":
      return (
        <>
          {pip}
          <FeatureScene
            src="images/frames/m-discord-alt.png"
            copy="Free. Fast. Yours."
            accent="Yours"
            mode="float"
            chips={[
              { label: "No Nitro tax", x: 90, y: 1260, delay: 10 },
              { label: "LFG built-in", x: 680, y: 300, delay: 14 },
              { label: "Free forever", x: 700, y: 1480, delay: 18 },
            ]}
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
