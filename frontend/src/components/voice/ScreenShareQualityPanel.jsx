import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  X,
  Check,
  Loader2,
  Maximize2,
  Gauge,
  Info,
} from "lucide-react";
import { GROUP_SCREEN_DEFAULT_QUALITY } from "../../lib/webrtcScreenShare";

export const SCREEN_RESOLUTION_PRESETS = [
  { value: "480p", label: "480p", desc: "854×480", hint: "En akıcı — düşük bant" },
  { value: "720p", label: "720p HD", desc: "1280×720", hint: "Önerilen denge" },
  { value: "1080p", label: "1080p", desc: "1920×1080", hint: "Net metin / UI" },
];

export const SCREEN_FPS_PRESETS = [
  { value: 15, label: "15 FPS", hint: "Sunum / slayt" },
  { value: 20, label: "20 FPS", hint: "Varsayılan" },
  { value: 24, label: "24 FPS", hint: "Akıcı hareket" },
  { value: 30, label: "30 FPS", hint: "1:1 aramalar" },
];

/**
 * Modern screen-share quality picker — used in CallOverlay (DM + group).
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
  const panelRef = useRef(null);
  const [applying, setApplying] = useState(false);
  const [appliedFlash, setAppliedFlash] = useState(false);
  const quality = screenQuality || GROUP_SCREEN_DEFAULT_QUALITY;

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

  const pickResolution = (resolution) => {
    const next = { ...quality, resolution };
    void applyChange(next);
  };

  const pickFps = (fps) => {
    const next = { ...quality, fps };
    void applyChange(next);
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
    (quality.resolution === "1080p" || (quality.fps || 20) > 24);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Screen share quality"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          style={{
            position: "absolute",
            bottom: "calc(100% + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(380px, calc(100vw - 32px))",
            zIndex: 50,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(165deg, rgba(28,28,34,0.98) 0%, rgba(18,18,22,0.99) 100%)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(88,101,242,0.15)",
            backdropFilter: "blur(20px)",
            padding: "16px 16px 14px",
            color: "#f4f4f8",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(88,101,242,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a5b4fc",
              }}
            >
              <Monitor size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Ekran paylaşımı kalitesi</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                {isScreenSharing ? "Canlı — değişiklik yeniden başlatır" : "Paylaşım başlamadan ayarla"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
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
                Grup aramasında ({participantCount} kişi) yüksek çözünürlük/FPS takılmaya yol açabilir. 720p / 20 FPS önerilir.
              </span>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
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
              <Maximize2 size={12} />
              Çözünürlük
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SCREEN_RESOLUTION_PRESETS.map((res) => {
                const active = quality.resolution === res.value;
                return (
                  <button
                    key={res.value}
                    type="button"
                    disabled={applying}
                    onClick={() => pickResolution(res.value)}
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
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{res.label}</div>
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

          <div style={{ marginBottom: isScreenSharing ? 10 : 14 }}>
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
              <Gauge size={12} />
              Kare hızı
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SCREEN_FPS_PRESETS.map((fps) => {
                const active = Number(quality.fps) === fps.value;
                const disabled =
                  applying || (isGroupCall && fps.value > 24 && participantCount >= 3);
                return (
                  <button
                    key={fps.value}
                    type="button"
                    disabled={disabled}
                    title={disabled ? "Grup için 24 FPS üstü kapalı" : fps.hint}
                    onClick={() => pickFps(fps.value)}
                    style={{
                      flex: "1 1 calc(50% - 4px)",
                      minWidth: 72,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: active
                        ? "1.5px solid #5865f2"
                        : "1.5px solid rgba(255,255,255,0.08)",
                      background: active
                        ? "rgba(88,101,242,0.18)"
                        : "rgba(255,255,255,0.04)",
                      color: disabled ? "rgba(255,255,255,0.35)" : "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {fps.label}
                  </button>
                );
              })}
            </div>
          </div>

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
              <Loader2 size={14} className="spin" style={{ animation: "spin 0.8s linear infinite" }} />
              Uygulanıyor…
            </div>
          )}

          {appliedFlash && !applying && (
            <div style={{ fontSize: 12, color: "#4ade80", marginBottom: 10 }}>Ayarlar uygulandı</div>
          )}

          {!isScreenSharing && (
            <button
              type="button"
              disabled={applying}
              onClick={handleStart}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #5865f2 0%, #4752c4 100%)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: applying ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {applying ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <Monitor size={18} />}
              Bu ayarlarla paylaş
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
