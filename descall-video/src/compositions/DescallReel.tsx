import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { BrandBackdrop, ScenePips } from "../components/Effects";
import { Fonts } from "../components/Fonts";
import { Hook } from "../scenes/Hook";
import { ProductReveal } from "../scenes/ProductReveal";
import { FeatureScene } from "../scenes/FeatureScene";
import { CTA } from "../scenes/CTA";
import { EDIT_PLAN } from "../editPlan";

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
            camera={{
              scaleFrom: 1.03,
              scaleTo: 1.07,
              x: 0.5,
              y: 0.36,
              panX: 4,
              panY: 14,
            }}
            chips={[
              { label: "Neon frame", x: 64, y: 260, delay: 12 },
              { label: "Titles · Badges", x: 620, y: 1500, delay: 18 },
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
            camera={{
              scaleFrom: 1.02,
              scaleTo: 1.055,
              x: 0.58,
              y: 0.36,
              panX: -8,
              panY: 8,
            }}
            chips={[
              { label: "1:1 & groups", x: 80, y: 1380, delay: 10 },
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
            camera={{
              scaleFrom: 1.02,
              scaleTo: 1.06,
              x: 0.5,
              y: 0.32,
              panX: 6,
              panY: 10,
            }}
            chips={[
              { label: "Themes", x: 720, y: 240, delay: 10 },
              { label: "Profile FX", x: 60, y: 1500, delay: 16 },
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
            camera={{
              scaleFrom: 1.03,
              scaleTo: 1.06,
              x: 0.5,
              y: 0.3,
              panX: 0,
              panY: 12,
            }}
            chips={[
              { label: "No Nitro tax", x: 90, y: 1280, delay: 12 },
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
        <Audio src={staticFile("audio/music.mp3")} volume={0.42} />
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
