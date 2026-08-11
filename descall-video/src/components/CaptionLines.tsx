import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AnimatedText } from "./AnimatedText";

export type CaptionLine = {
  text: string;
  accent?: string;
  /** frame offset within the scene */
  at: number;
  duration?: number;
};

/** Shows one caption at a time within a scene */
export const CaptionLines: React.FC<{
  lines: readonly CaptionLine[];
  sceneDuration: number;
  size?: number;
  bottom?: number;
}> = ({ lines, sceneDuration, size = 48, bottom = 230 }) => {
  return (
    <AbsoluteFill>
      {lines.map((line, i) => {
        const nextAt = lines[i + 1]?.at ?? sceneDuration;
        const dur = Math.max(20, nextAt - line.at - 4);
        return (
          <Sequence key={`${line.text}-${i}`} from={line.at} durationInFrames={dur}>
            <AnimatedText
              text={line.text}
              accentWord={line.accent}
              size={size}
              bottom={bottom}
              delay={2}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
