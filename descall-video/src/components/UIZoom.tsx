import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type CameraMove = Record<string, never>;

/** Full UI frame — no zoom, no crop, no spinning borders */
export const UIZoom: React.FC<{
  src: string;
  camera?: CameraMove;
  radius?: number;
  mode?: "card" | "full" | "float";
  dim?: number;
}> = ({ src, radius = 40, mode = "card", dim = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 100, mass: 0.85 },
  });

  const pad = mode === "full" ? 0 : mode === "float" ? 44 : 28;
  const cardRadius = mode === "full" ? 0 : radius;
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [mode === "full" ? 0 : 10, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: pad,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: cardRadius,
          overflow: "hidden",
          transform: `translateY(${y}px)`,
          opacity,
          background: "#080612",
          boxShadow:
            mode === "full"
              ? "none"
              : "0 36px 100px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center center",
            display: "block",
            filter: dim > 0 ? `brightness(${1 - dim})` : undefined,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
