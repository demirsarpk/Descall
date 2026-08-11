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
 * Neon border + glow animate around the card; image stays object-fit: contain.
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
  const borderAngle = (frame * 3) % 360;
  const glowPulse = 0.35 + 0.25 * Math.sin(frame / 12);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: pad,
      }}
    >
      {/* Outer neon aura */}
      {mode !== "full" ? (
        <div
          style={{
            position: "absolute",
            inset: pad - 8,
            borderRadius: cardRadius + 8,
            background: `conic-gradient(from ${borderAngle}deg, #8b9bff, #d0a4ff, #7ef0d0, #8b9bff)`,
            opacity: 0.35 + glowPulse * 0.25,
            filter: "blur(18px)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: cardRadius,
          overflow: "hidden",
          transform: `translateY(${y}px)`,
          opacity,
          background: "#080612",
          padding: mode === "full" ? 0 : 3,
          backgroundImage:
            mode === "full"
              ? undefined
              : `linear-gradient(#080612, #080612), conic-gradient(from ${borderAngle}deg, #8b9bff, #d0a4ff, #7ef0d0, #ff9ec8, #8b9bff)`,
          backgroundOrigin: "border-box",
          backgroundClip: mode === "full" ? undefined : "padding-box, border-box",
          border: mode === "full" ? "none" : "3px solid transparent",
          boxShadow:
            mode === "full"
              ? "none"
              : `0 40px 120px rgba(0,0,0,0.5), 0 0 ${40 * glowPulse}px rgba(139,155,255,${0.35 * glowPulse})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: Math.max(0, cardRadius - 4),
            overflow: "hidden",
            background: "#080612",
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
                  : "contrast(1.02) saturate(1.05)",
            }}
          />
        </div>

        {mode !== "full" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 14%, transparent 78%, rgba(0,0,0,0.22) 100%)",
              pointerEvents: "none",
              borderRadius: cardRadius,
            }}
          />
        ) : null}

        {/* shimmer sweep across card (doesn't crop image) */}
        {mode !== "full" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,${0.08 + 0.06 * Math.sin(frame / 10)}) 50%, transparent 60%)`,
              backgroundSize: "200% 100%",
              backgroundPosition: `${(frame * 3) % 200}% 0`,
              pointerEvents: "none",
              borderRadius: cardRadius,
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
