import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { FPS } from "../editPlan";

/** Speaks ONLY on-screen captions — denser 14-line script */
export const VOICE_CUES = [
  { startSec: 0.3, file: "vo/line01.mp3", text: "Tired of Discord?", durationSec: 1.776 },
  { startSec: 2.35, file: "vo/line02.mp3", text: "Discord, but different.", durationSec: 1.776 },
  { startSec: 4.4, file: "vo/line03.mp3", text: "Meet Descall.", durationSec: 1.776 },
  { startSec: 6.35, file: "vo/line04.mp3", text: "Chat, voice, and video — free.", durationSec: 2.616 },
  { startSec: 9.15, file: "vo/line05.mp3", text: "Real conversations.", durationSec: 1.776 },
  { startSec: 11.05, file: "vo/line06.mp3", text: "Cosmetics that actually show.", durationSec: 1.944 },
  { startSec: 13.45, file: "vo/line07.mp3", text: "Friends without the clutter.", durationSec: 1.776 },
  { startSec: 15.6, file: "vo/line08.mp3", text: "HD calls in one tap.", durationSec: 1.896 },
  { startSec: 17.85, file: "vo/line09.mp3", text: "Themes, frames, and titles.", durationSec: 2.352 },
  { startSec: 20.3, file: "vo/line10.mp3", text: "Make your profile yours.", durationSec: 1.776 },
  { startSec: 22.25, file: "vo/line11.mp3", text: "No Nitro paywall.", durationSec: 1.776 },
  { startSec: 24.55, file: "vo/line12.mp3", text: "Free. Fast. Built for friends.", durationSec: 2.616 },
  { startSec: 27.3, file: "vo/line13.mp3", text: "Start free today.", durationSec: 1.776 },
  { startSec: 29.4, file: "vo/line14.mp3", text: "descall.com", durationSec: 1.776 },
] as const;

export const Voiceover: React.FC = () => {
  return (
    <AbsoluteFill>
      {VOICE_CUES.map((cue) => {
        const from = Math.round(cue.startSec * FPS);
        const dur = Math.ceil((cue.durationSec + 0.12) * FPS);
        return (
          <Sequence key={cue.file} from={from} durationInFrames={dur}>
            <Audio src={staticFile(`audio/${cue.file}`)} volume={1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
