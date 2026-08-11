import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type CameraMove = {
  /** subtle scale start — keep near 1.0–1.08 */
  scaleFrom?: number;
  /** subtle scale end — travel ≤ ~0.06 */
  scaleTo?: number;
  /** pan origin 0–1 */
  x?: number;
  y?: number;
  /** gentle pan in px */
  panX?: number;
  panY?: number;
};

/**
 * Cinematic product frame — soft enter + micro Ken Burns.
 * Intentionally avoids aggressive zoom in/out.
 */
export const UIZoom: React.FC<{
  src: string;
  camera?: CameraMove;
  radius?: number;
  mode?: "card" | "full" | "float";
  dim?: number;
}> = ({
  src,
  camera = {},
  radius = 44,
  mode = "card",
  dim = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const {
    scaleFrom = 1.03,
    scaleTo = 1.07,
    x = 0.5,
    y = 0.42,
    panX = 0,
    panY = 10,
  } = camera;

  const enter = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 90, mass: 0.9 },
  });

  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.61, 0.36, 1),
  });

  const scale = interpolate(progress, [0, 1], [scaleFrom, scaleTo]);
  const shiftX = interpolate(progress, [0, 1], [-panX * 0.5, panX * 0.5]);
  const shiftY = interpolate(progress, [0, 1], [-panY * 0.4, panY * 0.6]);

  const pad = mode === "full" ? 0 : mode === "float" ? 56 : 36;
  const cardRadius = mode === "full" ? 0 : radius;
  const lift = interpolate(enter, [0, 1], [mode === "full" ? 0 : 18, 0]);
  const cardScale = interpolate(enter, [0, 1], [mode === "full" ? 1 : 0.975, 1]);
  const opacity = interpolate(enter, [0, 1], [0.0, 1]);

  // Soft vignette mask reveal
  const reveal = interpolate(frame, [0, 14], [0.82, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

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
          transform: `translateY(${lift}px) scale(${cardScale * reveal})`,
          opacity,
          background: "#080612",
          boxShadow:
            mode === "full"
              ? "none"
              : "0 50px 140px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${shiftX}px, ${shiftY}px) scale(${scale})`,
            transformOrigin: `${x * 100}% ${y * 100}%`,
            willChange: "transform",
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter:
                dim > 0
                  ? `brightness(${1 - dim}) contrast(1.04) saturate(1.05)`
                  : "contrast(1.03) saturate(1.04)",
            }}
          />
        </div>

        {/* top glass reflection */}
        {mode !== "full" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 18%, transparent 72%, rgba(0,0,0,0.28) 100%)",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
