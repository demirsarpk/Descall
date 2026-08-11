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

/** Kept for API compat — camera motion is disabled (no zoom / pan / crop). */
export type CameraMove = Record<string, never>;

/**
 * Full UI frame — no zoom in/out, no pan, no edge crop.
 * Image always uses object-fit: contain so nothing is cut off.
 */
export const UIZoom: React.FC<{
  src: string;
  camera?: CameraMove;
  radius?: number;
  mode?: "card" | "full" | "float";
  dim?: number;
}> = ({ src, radius = 44, mode = "card", dim = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 100, mass: 0.85 },
  });

  const pad = mode === "full" ? 0 : mode === "float" ? 48 : 32;
  const cardRadius = mode === "full" ? 0 : radius;
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [mode === "full" ? 0 : 14, 0]);

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
              : "0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.1)",
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
            filter:
              dim > 0
                ? `brightness(${1 - dim}) contrast(1.02)`
                : "contrast(1.02)",
          }}
        />

        {mode !== "full" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 14%, transparent 78%, rgba(0,0,0,0.2) 100%)",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
