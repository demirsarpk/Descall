import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { BrandBackdrop } from "../components/Transition";
import { Fonts } from "../components/Fonts";
import { Hook } from "../scenes/Hook";
import { ProductReveal } from "../scenes/ProductReveal";
import { FeatureScene } from "../scenes/FeatureScene";
import { CTA } from "../scenes/CTA";
import { EDIT_PLAN } from "../editPlan";

const sceneById = (id: string) => {
  switch (id) {
    case "hook":
      return <Hook />;
    case "product":
      return <ProductReveal />;
    case "feature-chat":
      return (
        <FeatureScene
          src="images/frames/app-open-dm.png"
          copy="Cosmetics that show."
          accent="show."
          zoom={{ start: 1.1, end: 1.26, x: 0.5, y: 0.36 }}
        />
      );
    case "feature-lfg":
      return (
        <FeatureScene
          src="images/frames/app-friends-2.png"
          copy="Friends. Calls. Done."
          accent="Done."
          zoom={{ start: 1.14, end: 1.05, x: 0.58, y: 0.38 }}
        />
      );
    case "feature-look":
      return (
        <FeatureScene
          src="images/frames/app-appearance.png"
          copy="Make it yours."
          accent="yours."
          zoom={{ start: 1.08, end: 1.16, x: 0.5, y: 0.32 }}
        />
      );
    case "payoff":
      return (
        <FeatureScene
          src="images/frames/m-discord-alt.png"
          copy="Free. Fast. Yours."
          accent="Yours."
          zoom={{ start: 1.22, end: 1.06, x: 0.5, y: 0.32 }}
        />
      );
    case "cta":
      return <CTA />;
    default:
      return null;
  }
};

export const DescallReel: React.FC = () => {
  return (
    <Fonts>
      <AbsoluteFill style={{ backgroundColor: "#07060d" }}>
        <BrandBackdrop />
        <Audio src={staticFile("audio/music.mp3")} volume={0.46} />
        <Series>
          {EDIT_PLAN.map((scene) => (
            <Series.Sequence key={scene.id} durationInFrames={scene.duration}>
              <AbsoluteFill>{sceneById(scene.id)}</AbsoluteFill>
            </Series.Sequence>
          ))}
        </Series>
        <Sequence from={0} durationInFrames={1} />
      </AbsoluteFill>
    </Fonts>
  );
};
