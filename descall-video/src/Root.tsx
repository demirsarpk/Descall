import React from "react";
import { Composition } from "remotion";
import { DescallReel } from "./compositions/DescallReel";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./editPlan";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DescallReel"
      component={DescallReel}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
