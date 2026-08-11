import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  X,
  Check,
  Loader2,
  Maximize2,
  Gauge,
  Info,
  Sparkles,
  Type,
  Gamepad2,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Activity,
} from "lucide-react";
import {
  GROUP_SCREEN_DEFAULT_QUALITY,
  SCREEN_QUALITY_PRESETS,
  estimateScreenShareMbps,
  matchScreenQualityPreset,
} from "../../lib/webrtcScreenShare";
import { useIsNarrowViewport } from "../../lib/useIsNarrowViewport";
import { useT } from "../../context/LocaleContext";

export const SCREEN_RESOLUTION_PRESETS = [
  { value: "480p", label: "480p", desc: "854×480", hintKey: "Smoothest — low bandwidth" },
  { value: "720p", label: "720p HD", desc: "1280×720", hintKey: "Recommended balance" },
  { value: "1080p", label: "1080p FHD", desc: "1920×1080", hintKey: "Sharp text / UI" },
  { value: "1440p", label: "1440p QHD", desc: "2560×1440", hintKey: "Ultra clarity (1:1)" },
];

export const SCREEN_FPS_PRESETS = [
  { value: 15, label: "15", hintKey: "Presentations / slides" },
  { value: 20, label: "20", hintKey: "Default" },
  { value: 24, label: "24", hintKey: "Smooth motion" },
  { value: 30, label: "30", hintKey: "1:1 calls" },
  { value: 60, label: "60", hintKey: "Game capture (1:1)" },
];

const PRESET_CARDS = [
  {
    id: "smooth",
    icon: Zap,
    titleKey: "Smooth",
    descKey: "Low bandwidth, fluid",
    accent: "#34d399",
  },
  {
    id: "balanced",
    icon: Sparkles,
    titleKey: "Balanced",
    descKey: "Best for most shares",
    accent: "#818cf8",
  },
  {
    id: "high",
    icon: Activity,
    titleKey: "High",
    descKey: "Full HD, 30 FPS",
    accent: "#60a5fa",
  },
  {
    id: "ultra",
    icon: Gamepad2,
    titleKey: "Ultra",
    descKey: "QHD gaming / video",
    accent: "#f472b6",
  },
  {
    id: "text",
    icon: Type,
    titleKey: "Text",
    descKey: "Code, docs, slides",
    accent: "#fbbf24",
  },
];

const CONTENT_MODES = [
  { value: "motion", labelKey: "Motion", descKey: "Games & video" },
  { value: "detail", labelKey: "Detail", descKey: "UI & photos" },
  { value: "text", labelKey: "Text", descKey: "Code & docs" },
];

function SectionLabel({ icon: Icon, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "rgba(255,255,255,0.45)",
        marginBottom: 8,
      }}
    >
      {Icon ? <Icon size={12} /> : null}
      {children}
    </div>
  );
}

/**
 * Advanced screen-share quality picker — presets + resolution / FPS / content mode.
 */
export default function ScreenShareQualityPanel({
  open,
  onClose,
  anchorRef,
  screenQuality,
  setScreenQuality,
  isScreenSharing,
  isGroupCall,
  participantCount = 2,
  onStartWithQuality,
  onRestartWithQuality,
}) {
  const t = useT();
  const panelRef = useRef(null);
  const [applying, setApplying] = useState(false);
  const [appliedFlash, setAppliedFlash] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const quality = screenQuality || GROUP_SCREEN_DEFAULT_QUALITY;
  const narrow = useIsNarrowViewport(720);
  const activePreset = useMemo(() => matchScreenQualityPreset(quality), [quality]);
  const mbps = useMemo(
    () => estimateScreenShareMbps(quality, participantCount),
    [quality, participantCount]
  );

  const resolutionOptions = useMemo(() => {
    if (isGroupCall && participantCount >= 3) {
      return SCREEN_RESOLUTION_PRESETS.filter((r) => r.value !== "1440p");
    }
    return SCREEN_RESOLUTION_PRESETS;
  }, [isGroupCall, participantCount]);

  const fpsOptions = useMemo(() => {
    if (isGroupCall && participantCount >= 3) {
      return SCREEN_FPS_PRESETS.filter((f) => f.value <= 24);
    }
    if (isGroupCall) {
      return SCREEN_FPS_PRESETS.filter((f) => f.value <= 30);
    }
    return SCREEN_FPS_PRESETS;
  }, [isGroupCall, participantCount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (open && activePreset === "custom") setShowAdvanced(true);
  }, [open, activePreset]);

  const applyChange = useCallback(
    async (nextQuality) => {
      setScreenQuality(nextQuality);
      if (!isScreenSharing) return;
      if (!onRestartWithQuality) return;
      setApplying(true);
      try {
        await onRestartWithQuality(nextQuality);
        setAppliedFlash(true);
        setTimeout(() => setAppliedFlash(false), 1200);
      } finally {
        setApplying(false);
      }
    },
    [isScreenSharing, onRestartWithQuality, setScreenQuality]
  );

  const pickPreset = (presetId) => {
    const preset = SCREEN_QUALITY_PRESETS[presetId];
    if (!preset) return;
    if (isGroupCall && participantCount >= 3 && (preset.resolution === "1440p" || preset.fps > 24)) {
      void applyChange({
        ...preset,
        resolution: preset.resolution === "1440p" ? "1080p" : preset.resolution,
        fps: Math.min(preset.fps, 24),
      });
      return;
    }
    void applyChange({ ...preset });
  };

  const pickResolution = (resolution) => {
    void applyChange({ ...quality, resolution });
  };

  const pickFps = (fps) => {
    void applyChange({ ...quality, fps });
  };

  const pickContentHint = (contentHint) => {
    void applyChange({ ...quality, contentHint });
  };

  const handleStart = async () => {
    setApplying(true);
    try {
      await onStartWithQuality?.(quality);
      onClose?.();
    } finally {
      setApplying(false);
    }
  };

  const meshWarning =
    isGroupCall &&
    participantCount >= 3 &&
    (quality.resolution === "1080p" ||
      quality.resolution === "1440p" ||
      (quality.fps || 20) > 24);

  const summary = `${quality.resolution || "720p"} · ${Number(quality.fps) || 24} FPS · ${
    quality.contentHint === "text"
      ? t("Text")
      : quality.contentHint === "detail"
        ? t("Detail")
        : t("Motion")
  }`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={t("Screen share quality")}
          initial={narrow ? { opacity: 0, y: 24 } : { opacity: 0, y: 12, x: "-50%", scale: 0.96 }}
          animate={narrow ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={narrow ? { opacity: 0, y: 24 } : { opacity: 0, y: 12, x: "-50%", scale: 0.96 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          style={{
            ...(narrow
              ? {
                  position: "fixed",
                  left: 12,
                  right: 12,
                  bottom: "max(12px, calc(env(safe-area-inset-bottom, 0px) + 88px))",
                  width: "auto",
                  maxHeight: "min(78dvh, calc(100dvh - 100px))",
                  overflowY: "auto",
                  overflowX: "hidden",
                  WebkitOverflowScrolling: "touch",
                  zIndex: 10050,
                }
              : {
                  position: "absolute",
                  bottom: "calc(100% + 14px)",
                  left: "50%",
                  width: "min(420px, calc(100vw - 32px))",
                  maxHeight: "min(78vh, 640px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  zIndex: 50,
                }),
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(165deg, rgba(30,30,38,0.99) 0%, rgba(14,14,18,0.995) 55%, rgba(18,16,28,0.99) 100%)",
            boxShadow: "0 28px 72px rgba(0,0,0,0.6), 0 0 0 1px rgba(88,101,242,0.18)",
            backdropFilter: "blur(22px)",
            padding: "16px 16px 14px",
            color: "#f4f4f8",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(145deg, rgba(88,101,242,0.35), rgba(167,139,250,0.2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c4b5fd",
              }}
            >
              <Monitor size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t("Screen share quality")}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                {isScreenSharing
                  ? t("Live — changes will restart sharing")
                  : t("Choose a preset or fine-tune below")}
              </div>
            </div>
            <div
              style={{
                padding: "6px 9px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 11,
                fontWeight: 600,
                color: "#c4b5fd",
                whiteSpace: "nowrap",
              }}
              title={t("Estimated encode bitrate")}
            >
              ~{mbps} Mbps
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Close")}
              style={{
                width: 32,
                height: 32,
                border: "none",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                color: "#aaa",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {summary}
            {activePreset !== "custom" ? ` · ${t("Preset")}` : ` · ${t("Custom")}`}
          </div>

          {meshWarning && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(240,165,0,0.12)",
                border: "1px solid rgba(240,165,0,0.25)",
                fontSize: 11,
                color: "#fcd34d",
                marginBottom: 12,
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {t(
                  "In a group call ({count} people), high resolution/FPS can cause lag. 720p / 20 FPS is recommended.",
                  { count: participantCount }
                )}
              </span>
            </div>
          )}

          <SectionLabel icon={Sparkles}>{t("Presets")}</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {PRESET_CARDS.map((card) => {
              const Icon = card.icon;
              const active = activePreset === card.id;
              const preset = SCREEN_QUALITY_PRESETS[card.id];
              const locked =
                isGroupCall &&
                participantCount >= 3 &&
                (preset.resolution === "1440p" || preset.fps > 24) &&
                card.id === "ultra";
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={applying || locked}
                  onClick={() => pickPreset(card.id)}
                  style={{
                    textAlign: "left",
                    padding: "11px 12px",
                    borderRadius: 14,
                    border: active ? `1.5px solid ${card.accent}` : "1.5px solid rgba(255,255,255,0.08)",
                    background: active
                      ? `linear-gradient(145deg, ${card.accent}22, rgba(255,255,255,0.03))`
                      : "rgba(255,255,255,0.035)",
                    color: "#fff",
                    cursor: locked || applying ? "not-allowed" : "pointer",
                    opacity: locked ? 0.4 : applying && !active ? 0.7 : 1,
                    position: "relative",
                    gridColumn: card.id === "text" ? "1 / -1" : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: `${card.accent}22`,
                        color: card.accent,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={15} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{t(card.titleKey)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                        {t(card.descKey)}
                      </div>
                    </div>
                    {active && <Check size={14} style={{ color: card.accent }} />}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.38)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {preset.resolution} · {preset.fps} FPS
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 12px",
              marginBottom: showAdvanced ? 12 : isScreenSharing ? 8 : 14,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <SlidersHorizontal size={14} />
              {t("Advanced settings")}
            </span>
            <ChevronDown
              size={16}
              style={{
                transform: showAdvanced ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
                opacity: 0.7,
              }}
            />
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ marginBottom: 12 }}>
                  <SectionLabel icon={Maximize2}>{t("Resolution")}</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {resolutionOptions.map((res) => {
                      const active = quality.resolution === res.value;
                      return (
                        <button
                          key={res.value}
                          type="button"
                          disabled={applying}
                          onClick={() => pickResolution(res.value)}
                          title={t(res.hintKey)}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: active
                              ? "1.5px solid #5865f2"
                              : "1.5px solid rgba(255,255,255,0.08)",
                            background: active
                              ? "rgba(88,101,242,0.18)"
                              : "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: applying ? "wait" : "pointer",
                            opacity: applying && !active ? 0.65 : 1,
                            position: "relative",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t(res.label)}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                            {res.desc}
                          </div>
                          {active && (
                            <Check
                              size={14}
                              style={{ position: "absolute", top: 10, right: 10, color: "#a5b4fc" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel icon={Gauge}>{t("Frame rate")}</SectionLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {fpsOptions.map((fps) => {
                      const active = Number(quality.fps) === fps.value;
                      const disabled = applying;
                      return (
                        <button
                          key={fps.value}
                          type="button"
                          disabled={disabled}
                          title={t(fps.hintKey)}
                          onClick={() => pickFps(fps.value)}
                          style={{
                            flex: "1 1 calc(20% - 6px)",
                            minWidth: 56,
                            padding: "9px 8px",
                            borderRadius: 10,
                            border: active
                              ? "1.5px solid #5865f2"
                              : "1.5px solid rgba(255,255,255,0.08)",
                            background: active
                              ? "rgba(88,101,242,0.18)"
                              : "rgba(255,255,255,0.04)",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: disabled ? "wait" : "pointer",
                          }}
                        >
                          {fps.label}
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 500,
                              color: "rgba(255,255,255,0.4)",
                              marginTop: 2,
                            }}
                          >
                            FPS
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: isScreenSharing ? 10 : 14 }}>
                  <SectionLabel icon={Type}>{t("Optimize for")}</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {CONTENT_MODES.map((mode) => {
                      const isActive = (quality.contentHint || "motion") === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          disabled={applying}
                          onClick={() => pickContentHint(mode.value)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: 12,
                            border: isActive
                              ? "1.5px solid #a78bfa"
                              : "1.5px solid rgba(255,255,255,0.08)",
                            background: isActive
                              ? "rgba(167,139,250,0.16)"
                              : "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: applying ? "wait" : "pointer",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{t(mode.labelKey)}</div>
                          <div
                            style={{
                              fontSize: 9,
                              color: "rgba(255,255,255,0.42)",
                              marginTop: 3,
                              lineHeight: 1.25,
                            }}
                          >
                            {t(mode.descKey)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {applying && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#a5b4fc",
                marginBottom: 10,
              }}
            >
              <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
              {t("Applying…")}
            </div>
          )}

          {appliedFlash && !applying && (
            <div style={{ fontSize: 12, color: "#4ade80", marginBottom: 10 }}>
              {t("Settings applied")}
            </div>
          )}

          {!isScreenSharing && (
            <button
              type="button"
              disabled={applying}
              onClick={handleStart}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 13,
                border: "none",
                background: "linear-gradient(135deg, #5865f2 0%, #7c3aed 55%, #4752c4 100%)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: applying ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 10px 28px rgba(88,101,242,0.35)",
              }}
            >
              {applying ? (
                <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <Monitor size={18} />
              )}
              {t("Share with these settings")}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
