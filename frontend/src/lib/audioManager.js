/**
 * AudioManager - Centralized audio system for Descall
 * 
 * Features:
 * - Preload all sounds on init
 * - Play/stop sounds by type
 * - Loop support for ringtone
 * - Global and per-type mute controls
 * - Cooldown system to prevent spam
 * - Electron-safe (HTML5 Audio API)
 * - Automatic cleanup and memory management
 */

import { getSoundSettings, setSoundSettings } from "./storage";
import {
  isKnownSoundPack,
  playSoundPackCue,
  preloadSoundPack,
  startSoundPackLoop,
  unlockSoundPackAudio,
} from "./soundPackSynth";

// Detect Electron environment
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

const SYNTH_TYPES = new Set(["message", "notification", "incomingCall", "outgoingCall", "callStart"]);

// Get correct sound path based on environment
function getSoundPath(filename) {
  if (isElectron) {
    // In Electron, use relative path from the app root
    // Sounds are in the resources/sounds folder
    return `sounds/${filename}`;
  }
  // Web: use absolute path from public
  return `/sounds/${filename}`;
}

// Default sound URLs - can be replaced with actual file paths
const DEFAULT_SOUNDS = {
  incomingCall: getSoundPath("incoming-call.mp3"),
  outgoingCall: getSoundPath("outgoing-call.mp3"),
  callStart: getSoundPath("outgoing-call.mp3"), // Same as outgoing
  message: getSoundPath("message.mp3"),
  notification: getSoundPath("notification.mp3")
};

// Cooldown configuration (ms)
const COOLDOWNS = {
  message: 350,
  notification: 500,
};

class AudioManager {
  constructor() {
    this.sounds = {};
    this.activeLoops = new Set();
    this.settings = {
      globalMute: false,
      incomingCall: true,
      outgoingCall: true,
      callStart: true,
      message: true,
      notification: true,
      volume: 1.0,
      backgroundVolume: 0.5,
    };
    this.cooldowns = new Map();
    this.lastPlayed = new Map();
    this.isBackgrounded = false;
    this.preloadComplete = false;
    this.soundPackKey = null;
    this.synthLoops = new Map();

    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.unlockAudio = this.unlockAudio.bind(this);
  }

  /**
   * Initialize the audio manager
   * - Load settings from storage
   * - Preload all sounds
   * - Set up visibility/background handlers
   */
  async init(customSounds = {}) {
    // Load saved settings
    const saved = getSoundSettings();
    if (saved) {
      this.settings = { ...this.settings, ...saved };
    }

    // Merge default and custom sounds
    const soundUrls = { ...DEFAULT_SOUNDS, ...customSounds };

    // Preload all sounds
    await this.preload(soundUrls);

    // Set up visibility/background detection
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("blur", this.handleWindowBlur);
      window.addEventListener("focus", this.handleWindowFocus);
    }

    this.preloadComplete = true;

    // Unlock Web Audio on first gesture (required for catalog synth packs)
    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", this.unlockAudio, { once: true, passive: true });
      window.addEventListener("keydown", this.unlockAudio, { once: true, passive: true });
    }

    console.log("[AudioManager] Initialized with", Object.keys(this.sounds).length, "sounds");
  }

  async unlockAudio() {
    await unlockSoundPackAudio();
  }

  /**
   * Equip a catalog sound_pack effect_key (or null to use default MP3s).
   */
  setSoundPack(effectKey) {
    const next = isKnownSoundPack(effectKey) ? effectKey : null;
    if (this.soundPackKey === next) return;
    // Stop pack-based loops before switching
    this.synthLoops.forEach((stop) => {
      try {
        stop();
      } catch {
        /* ignore */
      }
    });
    this.synthLoops.clear();
    this.soundPackKey = next;
    if (next) preloadSoundPack(next);
  }

  getSoundPack() {
    return this.soundPackKey;
  }

  effectiveVolume(override) {
    if (override !== undefined) return override;
    return this.isBackgrounded
      ? this.settings.volume * this.settings.backgroundVolume
      : this.settings.volume;
  }

  playSynth(type, { loop = false, volume } = {}) {
    const pack = this.soundPackKey;
    if (!pack) return false;
    const vol = this.effectiveVolume(volume);
    const role = type === "callStart" ? "outgoingCall" : type;

    if (loop) {
      if (this.synthLoops.has(type)) return true;
      // Prefer synth ringtone; also stop HTML5 loop of same type
      try {
        this.sounds[type]?.pause?.();
      } catch {
        /* ignore */
      }
      const stop = startSoundPackLoop(pack, role, vol);
      this.synthLoops.set(type, stop);
      this.activeLoops.add(type);
      return true;
    }

    const ok = playSoundPackCue(pack, role, vol);
    if (ok && COOLDOWNS[type]) this.lastPlayed.set(type, Date.now());
    return ok;
  }

  /**
   * Preload all sound files
   */
  async preload(soundUrls) {
    const promises = Object.entries(soundUrls).map(([type, url]) => {
      return new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = "auto";
        
        audio.addEventListener("canplaythrough", () => {
          this.sounds[type] = audio;
          resolve();
        }, { once: true });

        audio.addEventListener("error", () => {
          console.warn(`[AudioManager] Failed to load sound: ${type}`);
          resolve(); // Resolve anyway to not block initialization
        }, { once: true });

        // Set a timeout in case loading hangs
        setTimeout(() => {
          if (!this.sounds[type]) {
            console.warn(`[AudioManager] Timeout loading sound: ${type}`);
            resolve();
          }
        }, 5000);

        audio.src = url;
      });
    });

    await Promise.all(promises);
  }

  /**
   * Handle page visibility change (tab switch)
   */
  handleVisibilityChange() {
    this.isBackgrounded = document.hidden;
    if (this.isBackgrounded) {
      // Reduce volume for background sounds
      this.updateVolume();
    } else {
      this.updateVolume();
    }
  }

  /**
   * Handle window blur (Electron unfocused)
   */
  handleWindowBlur() {
    this.isBackgrounded = true;
    this.updateVolume();
  }

  /**
   * Handle window focus (Electron focused)
   */
  handleWindowFocus() {
    this.isBackgrounded = false;
    this.updateVolume();
  }

  /**
   * Update volume for all sounds based on background state
   */
  updateVolume() {
    const targetVolume = this.isBackgrounded 
      ? this.settings.volume * this.settings.backgroundVolume 
      : this.settings.volume;

    Object.values(this.sounds).forEach(audio => {
      if (audio) audio.volume = targetVolume;
    });
  }

  /**
   * Check if sound is allowed to play (cooldown + settings check)
   */
  canPlay(type) {
    // Check global mute
    if (this.settings.globalMute) return false;

    // Check per-type mute
    if (this.settings[type] === false) return false;

    // Check cooldown for non-looping sounds
    if (COOLDOWNS[type]) {
      const now = Date.now();
      const lastPlayed = this.lastPlayed.get(type) || 0;
      if (now - lastPlayed < COOLDOWNS[type]) return false;
    }

    return true;
  }

  /**
   * Play a sound
   * @param {string} type - Sound type ('incomingCall', 'outgoingCall', 'message', 'notification')
   * @param {Object} options - Play options
   * @param {boolean} options.loop - Whether to loop the sound
   * @param {number} options.volume - Override volume (0-1)
   */
  play(type, options = {}) {
    if (!this.preloadComplete) {
      console.warn("[AudioManager] Not initialized yet");
      return false;
    }

    const { loop = false, volume } = options;

    // Check if we can play
    if (!loop && !this.canPlay(type)) return false;

    // Catalog sound packs: unique Web Audio voices per effect_key
    if (this.soundPackKey && SYNTH_TYPES.has(type)) {
      void unlockSoundPackAudio();
      const synthOk = this.playSynth(type, { loop, volume });
      if (synthOk) return true;
      // fall through to MP3 defaults if synth fails
    }

    // Check if already playing (for looping sounds)
    if (loop && this.activeLoops.has(type)) {
      // Already playing, just ensure it's not paused
      const audio = this.sounds[type];
      if (audio && audio.paused) {
        audio.play().catch(() => {});
      }
      return true;
    }

    const audio = this.sounds[type];
    if (!audio) {
      console.warn(`[AudioManager] Sound not found: ${type}`);
      return false;
    }

    // Clone audio for overlapping sounds (except looping sounds)
    const playAudio = loop ? audio : audio.cloneNode();
    
    // Set volume
    playAudio.volume = volume !== undefined 
      ? volume 
      : (this.isBackgrounded ? this.settings.volume * this.settings.backgroundVolume : this.settings.volume);

    // Set loop
    playAudio.loop = loop;

    // Reset and play
    playAudio.currentTime = 0;
    
    const playPromise = playAudio.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn(`[AudioManager] Play failed for ${type}:`, err.message);
      });
    }

    // Track looping sounds
    if (loop) {
      this.activeLoops.add(type);
    }

    // Update cooldown timestamp
    if (!loop) {
      this.lastPlayed.set(type, Date.now());
    }

    // Clean up cloned audio when done
    if (!loop) {
      playAudio.addEventListener("ended", () => {
        playAudio.remove();
      }, { once: true });
    }

    return true;
  }

  /**
   * Stop a playing sound
   * @param {string} type - Sound type to stop
   */
  stop(type) {
    const synthStop = this.synthLoops.get(type);
    if (synthStop) {
      try {
        synthStop();
      } catch {
        /* ignore */
      }
      this.synthLoops.delete(type);
      this.activeLoops.delete(type);
    }

    const audio = this.sounds[type];
    if (!audio) return;

    const wasLooping = this.activeLoops.has(type);
    const wasPlaying = !audio.paused || wasLooping;

    // Stop the audio
    audio.pause();
    audio.currentTime = 0;

    // Remove from active loops
    this.activeLoops.delete(type);

    if (wasPlaying) {
      console.log(`[AudioManager] Stopped: ${type}`);
    }
  }

  /**
   * Stop all looping sounds (useful when call ends)
   */
  stopAllLoops() {
    this.activeLoops.forEach((type) => {
      this.stop(type);
    });
    this.activeLoops.clear();
  }

  /**
   * Set global mute state
   */
  setGlobalMute(muted) {
    this.settings.globalMute = muted;
    this.saveSettings();

    if (muted) {
      // Stop all sounds immediately when muting
      this.stopAllLoops();
    }
  }

  /**
   * Set per-type mute state
   */
  setTypeMute(type, enabled) {
    this.settings[type] = enabled;
    this.saveSettings();

    if (!enabled) {
      // Stop this type if currently playing
      this.stop(type);
    }
  }

  /**
   * Set master volume
   */
  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.updateVolume();
    this.saveSettings();
  }

  /**
   * Set background volume multiplier
   */
  setBackgroundVolume(volume) {
    this.settings.backgroundVolume = Math.max(0, Math.min(1, volume));
    this.updateVolume();
    this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Save settings to storage
   */
  saveSettings() {
    setSoundSettings(this.settings);
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    // Stop all sounds
    this.stopAllLoops();
    Object.keys(this.sounds).forEach((type) => this.stop(type));

    // Remove event listeners
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", this.handleWindowBlur);
      window.removeEventListener("focus", this.handleWindowFocus);
    }

    // Clear references
    this.sounds = {};
    this.activeLoops.clear();
    this.cooldowns.clear();
    this.lastPlayed.clear();

    console.log("[AudioManager] Destroyed");
  }
}

// Create singleton instance
const audioManager = new AudioManager();

export default audioManager;

// Convenience exports
export const playSound = (type, options) => audioManager.play(type, options);
export const stopSound = (type) => audioManager.stop(type);
export const stopAllSounds = () => audioManager.stopAllLoops();
export const setGlobalMute = (muted) => audioManager.setGlobalMute(muted);
export const setSoundEnabled = (type, enabled) => audioManager.setTypeMute(type, enabled);
export const setSoundVolume = (volume) => audioManager.setVolume(volume);
export const getAudioSettings = () => audioManager.getSettings();
export const initAudioManager = (customSounds) => audioManager.init(customSounds);
export const destroyAudioManager = () => audioManager.destroy();
export const setEquippedSoundPack = (effectKey) => audioManager.setSoundPack(effectKey);
export const previewSoundPack = (effectKey, volume) => {
  void unlockSoundPackAudio();
  if (!isKnownSoundPack(effectKey)) return false;
  // Shop preview: play the notification clip (short, recognizable)
  return playSoundPackCue(effectKey, "notification", volume ?? audioManager.getSettings().volume);
};
