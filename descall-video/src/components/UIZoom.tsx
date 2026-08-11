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

type Zoom = { start: number; end: number; x: number; y: number };

export const UIZoom: React.FC<{
  src: string;
  zoom: Zoom;
  radius?: number;
  dim?: number;
}> = ({ src, zoom, radius = 36, dim = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.8 },
  });

  const scale = interpolate(frame, [0, durationInFrames - 1], [zoom.start, zoom.end], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(enter, [0, 1], [0.85, 1]);
  const yLift = interpolate(enter, [0, 1], [28, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 28,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: radius,
          overflow: "hidden",
          boxShadow:
            "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
          transform: `translateY(${yLift}px) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
          opacity,
          background: "#0a0814",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${scale})`,
            transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%`,
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: dim > 0 ? `brightness(${1 - dim})` : undefined,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
