import { useCallback, useRef, useState } from "react";

/**
 * Soft banner parallax — moves the background layer with pointer offset.
 * Falls back to a static fill when no image URL is provided.
 */
export default function ParallaxBanner({
  imageUrl,
  fallbackStyle,
  height = 80,
  className = "",
  strength = 10,
}) {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      setOffset({
        x: Math.max(-1, Math.min(1, nx)) * strength,
        y: Math.max(-1, Math.min(1, ny)) * strength,
      });
    },
    [strength]
  );

  const onLeave = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return (
    <div
      ref={ref}
      className={`profile-banner-parallax ${className}`.trim()}
      style={{ height, flexShrink: 0 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {imageUrl ? (
        <div
          className="profile-banner-parallax-layer"
          style={{
            backgroundImage: imageUrl,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(1.08)`,
          }}
        />
      ) : (
        <div className="profile-banner-parallax-fallback" style={fallbackStyle} />
      )}
    </div>
  );
}
