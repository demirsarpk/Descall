import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { FPS } from "../editPlan";

/**
 * Speaks ONLY the on-screen captions — nothing else.
 * Timings aligned to scene copy appearance.
 */
export const VOICE_CUES = [
  { startSec: 0.35, file: "vo/line01.mp3", text: "Discord, but different." },
  { startSec: 2.55, file: "vo/line02.mp3", text: "Meet Descall." },
  { startSec: 5.15, file: "vo/line03.mp3", text: "Cosmetics that show." },
  { startSec: 8.75, file: "vo/line04.mp3", text: "Friends. Calls. Done." },
  { startSec: 12.0, file: "vo/line05.mp3", text: "Make it yours." },
  { startSec: 15.4, file: "vo/line06.mp3", text: "Free. Fast. Yours." },
  { startSec: 19.5, file: "vo/line07.mp3", text: "Start free at descall.com" },
] as const;

export const Voiceover: React.FC = () => {
  return (
    <AbsoluteFill>
      {VOICE_CUES.map((cue) => {
        const from = Math.round(cue.startSec * FPS);
        return (
          <Sequence key={cue.file} from={from}>
            <Audio src={staticFile(`audio/${cue.file}`)} volume={1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
