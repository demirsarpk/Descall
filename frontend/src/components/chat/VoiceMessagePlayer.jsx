import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { waveformFromSeed } from "../../lib/voiceMessage";
import { useT } from "../../context/LocaleContext";

/** Only one voice note plays at a time across the app */
const stopBus = typeof window !== "undefined" ? new EventTarget() : null;

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (!Number.isFinite(s)) return "0:00";
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Chrome/Firefox often report MediaRecorder webm duration as Infinity until seeked.
 */
function resolveAudioDuration(audio) {
  return new Promise((resolve) => {
    if (!audio) {
      resolve(0);
      return;
    }

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      cleanup();
      const n = Number(value);
      resolve(Number.isFinite(n) && n > 0 ? n : 0);
    };

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };

    const onTimeUpdate = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        finish(audio.duration);
      }
    };

    const tryInfinityHack = () => {
      if (audio.duration === Infinity || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        audio.addEventListener("timeupdate", onTimeUpdate);
        try {
          // Seek far ahead forces browser to compute real duration for webm
          audio.currentTime = 1e101;
        } catch {
          finish(0);
        }
        // Safety timeout
        window.setTimeout(() => finish(0), 1500);
        return;
      }
      finish(audio.duration);
    };

    const onMeta = () => tryInfinityHack();

    if (audio.readyState >= 1) {
      tryInfinityHack();
    } else {
      audio.addEventListener("loadedmetadata", onMeta);
      audio.addEventListener("durationchange", onMeta);
      try {
        audio.load();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => finish(Number.isFinite(audio.duration) ? audio.duration : 0), 2000);
    }
  });
}

export default function VoiceMessagePlayer({ audioUrl, duration: durationProp = 0, isOwn = false }) {
  const t = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(
    Number(durationProp) > 0 ? Number(durationProp) : 0
  );
  const [error, setError] = useState("");
  const audioRef = useRef(null);
  const idRef = useRef(`vm-${Math.random().toString(36).slice(2)}`);
  const bars = useMemo(() => waveformFromSeed(audioUrl || idRef.current), [audioUrl]);

  const duration = resolvedDuration > 0 ? resolvedDuration : Number(durationProp) > 0 ? Number(durationProp) : 0;

  useEffect(() => {
    setResolvedDuration(Number(durationProp) > 0 ? Number(durationProp) : 0);
    setCurrentTime(0);
    setIsPlaying(false);
    setError("");
  }, [audioUrl, durationProp]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return undefined;

    let cancelled = false;
    resolveAudioDuration(audio).then((d) => {
      if (cancelled) return;
      if (d > 0) setResolvedDuration((prev) => (prev > 0 ? prev : d));
    });

    const onTimeUpdate = () => {
      const cur = audio.currentTime || 0;
      const cap = Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity
        ? audio.duration
        : duration > 0
          ? duration
          : null;
      if (cap != null && cur >= cap - 0.05) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }
      setCurrentTime(cur);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setError(t("Can't play this voice note"));
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      cancelled = true;
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  }, [audioUrl, duration, t]);

  // Stop when another voice note starts
  useEffect(() => {
    if (!stopBus) return undefined;
    const onStop = (e) => {
      if (e.detail === idRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      setIsPlaying(false);
    };
    stopBus.addEventListener("descall-voice-stop", onStop);
    return () => stopBus.removeEventListener("descall-voice-stop", onStop);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    setError("");

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    stopBus?.dispatchEvent(new CustomEvent("descall-voice-stop", { detail: idRef.current }));

    try {
      if (!Number.isFinite(audio.duration) || audio.duration === Infinity || audio.duration <= 0) {
        const d = await resolveAudioDuration(audio);
        if (d > 0) setResolvedDuration((prev) => (prev > 0 ? prev : d));
      }
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("[VoiceMessage] play failed:", err);
      setIsPlaying(false);
      setError(t("Tap again to play"));
    }
  }, [audioUrl, t]);

  const seekFromClick = useCallback(
    (e) => {
      const audio = audioRef.current;
      if (!audio || duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const next = ratio * duration;
      try {
        audio.currentTime = next;
        setCurrentTime(next);
      } catch {
        /* ignore */
      }
    },
    [duration]
  );

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const playedBars = Math.floor((progressPercent / 100) * bars.length);
  const displayTime = isPlaying || currentTime > 0
    ? formatTime(Math.min(currentTime, duration || currentTime))
    : formatTime(duration);

  if (!audioUrl) {
    return <div className="voice-message-bubble is-broken">{t("Voice unavailable")}</div>;
  }

  return (
    <div className={`voice-message-bubble ${isOwn ? "own" : "other"}${error ? " has-error" : ""}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" playsInline />

      <button
        type="button"
        className="voice-play-btn"
        onClick={togglePlay}
        title={isPlaying ? t("Pause") : t("Play")}
        aria-label={isPlaying ? t("Pause voice message") : t("Play voice message")}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      <button
        type="button"
        className="voice-waveform-container"
        onClick={seekFromClick}
        aria-label={t("Seek voice message")}
      >
        <div className="voice-waveform-bars" aria-hidden>
          {bars.map((height, index) => (
            <span
              key={index}
              className={`voice-bar${index < playedBars ? " played" : ""}`}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          ))}
        </div>
        <div className="voice-progress" style={{ width: `${progressPercent}%` }} />
      </button>

      <span className="voice-duration">{error || displayTime}</span>
    </div>
  );
}
