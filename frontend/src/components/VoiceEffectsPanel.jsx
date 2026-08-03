import { useState, useEffect, useRef, useCallback } from 'react';
import voiceEffects from '../lib/voiceEffects';
import { 
  Mic, 
  Wand2, 
  Volume2, 
  Activity, 
  Check, 
  Settings2,
  Sparkles,
  Radio,
  Mountain,
  Wind,
  Ghost,
  Baby,
  Phone,
  Megaphone,
  Droplets,
  Building,
  Home,
  Music,
  Zap,
  Headphones,
  VolumeX
} from 'lucide-react';
import { useT } from '../context/LocaleContext';
import './VoiceEffectsPanel.css';

const PRESET_ICONS = {
  none: Mic,
  robot: Wand2,
  radio: Radio,
  cave: Mountain,
  helium: Wind,
  monster: Ghost,
  telephone: Phone,
  megaphone: Megaphone,
  underwater: Droplets,
  stadium: Building,
  small_room: Home,
  concert_hall: Music,
  whisper: Volume2,
  demon: Ghost,
  alien: Sparkles,
  baby: Baby,
  giant: Mountain,
  echo: Activity,
  reverb_only: Music,
  autotune: Zap,
  harmonizer: Music
};

export default function VoiceEffectsPanel({ isOpen, onClose, localStream, onProcessedStream }) {
  const t = useT();
  const [presets, setPresets] = useState([]);
  const [currentPreset, setCurrentPreset] = useState('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rnnoiseEnabled, setRnnoiseEnabled] = useState(false);
  const [visualizationData, setVisualizationData] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [sidetoneEnabled, setSidetoneEnabled] = useState(false);
  const [sidetoneVolume, setSidetoneVolume] = useState(60);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const processedStreamRef = useRef(null);
  const sidetoneGainRef = useRef(null);
  const sidetoneSourceRef = useRef(null);
  const audioContextRef = useRef(null);

  const stopSidetone = useCallback(() => {
    if (sidetoneGainRef.current) {
      try {
        sidetoneGainRef.current.disconnect();
      } catch (e) {}
      sidetoneGainRef.current = null;
    }
    if (sidetoneSourceRef.current) {
      try {
        sidetoneSourceRef.current.disconnect();
      } catch (e) {}
      sidetoneSourceRef.current = null;
    }
    setSidetoneEnabled(false);
  }, []);

  const startSidetone = useCallback(async () => {
    if (!processedStreamRef.current && !localStream) return;
    
    try {
      // Stop previous sidetone
      stopSidetone();

      if (!audioContextRef.current) {
        audioContextRef.current = voiceEffects.audioContext || new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Use processed stream if available, otherwise raw stream
      const stream = processedStreamRef.current || localStream;
      const source = ctx.createMediaStreamSource(stream);
      
      const gain = ctx.createGain();
      gain.gain.value = sidetoneVolume / 100; // 0-1 volume
      
      source.connect(gain);
      gain.connect(ctx.destination);
      
      sidetoneSourceRef.current = source;
      sidetoneGainRef.current = gain;
      
      setSidetoneEnabled(true);
    } catch (err) {
      console.error('[VoiceEffects] Sidetone error:', err);
      setSidetoneEnabled(false);
    }
  }, [localStream, sidetoneVolume, stopSidetone]);

  const toggleSidetone = useCallback(() => {
    if (sidetoneEnabled) {
      stopSidetone();
    } else {
      startSidetone();
    }
  }, [sidetoneEnabled, startSidetone, stopSidetone]);

  const handleSidetoneVolumeChange = useCallback((e) => {
    const vol = parseInt(e.target.value, 10);
    setSidetoneVolume(vol);
    if (sidetoneGainRef.current) {
      sidetoneGainRef.current.gain.value = vol / 100;
    }
  }, []);

  // TDZ FIX: stopVoiceEffects MUST be defined before any useEffect that uses it
  const stopVoiceEffects = useCallback(() => {
    voiceEffects.stop();
    stopSidetone();
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach(track => track.stop());
      processedStreamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsProcessing(false);
  }, [stopSidetone]);

  // Initialize voice effects with cancellation support
  useEffect(() => {
    let isCancelled = false;
    
    const init = async () => {
      if (!isOpen) return;
      
      setIsInitializing(true);
      setError(null);
      
      try {
        await voiceEffects.initialize();
        
        if (isCancelled) {
          voiceEffects.stop();
          return;
        }
        
        if (voiceEffects.isInitialized) {
          setPresets(voiceEffects.getPresets());
          setCurrentPreset(voiceEffects.getCurrentPreset());
          setIsProcessing(true);
          setRnnoiseEnabled(voiceEffects.isRNNoiseEnabled());
        } else {
          setError(t('Voice effects failed to start'));
        }
      } catch (err) {
        if (!isCancelled) {
          setError(t('Initialization error: {message}', { message: err.message }));
        }
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
        }
      }
    };
    
    init();
    
    return () => {
      isCancelled = true;
      stopVoiceEffects();
    };
  }, [isOpen, stopVoiceEffects, t]);

  // Process stream when localStream changes
  useEffect(() => {
    let isActive = true;
    
    const process = async () => {
      if (!isOpen || !localStream || !isProcessing) return;
      
      if (!voiceEffects.audioContext || voiceEffects.audioContext.state !== 'running') {
        console.log('[VoiceEffectsPanel] Waiting for initialization...');
        return;
      }
      
      try {
        if (processedStreamRef.current) {
          processedStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        voiceEffects.stop();
        
        if (!isActive) return;
        
        const processedStream = await voiceEffects.start(localStream);
        
        if (!isActive) {
          processedStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        processedStreamRef.current = processedStream;
        
        if (onProcessedStream) {
          onProcessedStream(processedStream);
        }
      } catch (err) {
        if (isActive) {
          console.error('Stream processing error:', err);
          setError(t('Audio processing failed: {message}', { message: err.message }));
        }
      }
    };
    
    process();
    
    return () => {
      isActive = false;
    };
  }, [isOpen, localStream, isProcessing, onProcessedStream, t]);

  // Auto-connect sidetone when stream changes
  useEffect(() => {
    if (sidetoneEnabled && (processedStreamRef.current || localStream)) {
      startSidetone();
    }
    return () => {
      stopSidetone();
    };
  }, [processedStreamRef.current, localStream, sidetoneEnabled, startSidetone, stopSidetone]);

  // Visualization
  useEffect(() => {
    if (!isOpen || !isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const animate = () => {
      const data = voiceEffects.getVisualizationData();
      if (data) {
        drawVisualization(ctx, canvas, data);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, isProcessing]);

  const drawVisualization = (ctx, canvas, data) => {
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / data.length;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height * 0.8;
      const x = i * barWidth;
      const y = height - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, height);
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(0.5, '#6366f1');
      gradient.addColorStop(1, '#3b82f6');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const handlePresetChange = async (presetId) => {
    try {
      if (currentPreset === presetId) {
        console.log('[VoiceEffects] Preset already active:', presetId);
        return;
      }
      
      console.log('[VoiceEffects] Changing preset from', currentPreset, 'to', presetId);
      await voiceEffects.setPreset(presetId);
      setCurrentPreset(presetId);
      
      // Restart sidetone after preset change to hear new effect
      if (sidetoneEnabled && processedStreamRef.current) {
        stopSidetone();
        setTimeout(() => startSidetone(), 100);
      }
    } catch (err) {
      console.error('Preset change error:', err);
      setCurrentPreset('none');
    }
  };

  const handleRNNoiseToggle = () => {
    const newEnabled = !rnnoiseEnabled;
    voiceEffects.toggleRNNoise(newEnabled);
    setRnnoiseEnabled(newEnabled);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-effects-panel-overlay" onClick={onClose}>
      <div className="voice-effects-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div className="header-title">
            <Sparkles className="icon" />
            <h2>{t("Voice Effects")}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {isInitializing && (
          <div className="loading-state">
            <div className="spinner" />
            <span>{t("Voice engine starting...")}</span>
          </div>
        )}

        <div className="panel-content">
          {/* Visualization */}
          <div className="visualization-section">
            <canvas 
              ref={canvasRef} 
              width={600} 
              height={150}
              className="visualizer-canvas"
            />
            <div className="visualization-label">
              <Activity size={14} />
              <span>{t("Real-time Spectrum")}</span>
            </div>
          </div>

          {/* Sidetone / Audio Monitoring */}
          <div className="rnnoise-section sidetone-section">
            <div className="rnnoise-info">
              <Headphones size={18} className={sidetoneEnabled ? 'active-icon' : ''} />
              <div>
                <span className="rnnoise-title">{t("Sidetone")}</span>
                <span className="rnnoise-desc">{t("Hear your own voice to test effects")}</span>
              </div>
            </div>
            <button 
              className={`toggle-btn ${sidetoneEnabled ? 'active' : ''}`}
              onClick={toggleSidetone}
            >
              {sidetoneEnabled ? <Headphones size={16} /> : <VolumeX size={16} />}
              {sidetoneEnabled ? t("On") : t("Off")}
            </button>
          </div>

          {/* Sidetone Volume Slider */}
          {sidetoneEnabled && (
            <div className="sidetone-volume-section">
              <div className="volume-slider-row">
                <Volume2 size={14} className="volume-icon-low" />
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={sidetoneVolume}
                  onChange={handleSidetoneVolumeChange}
                  className="volume-slider"
                />
                <Volume2 size={18} className="volume-icon-high" />
                <span className="volume-percent">{sidetoneVolume}%</span>
              </div>
              <p className="sidetone-hint">
                {t("⚠ High volume may damage headphones. Start at a low level.")}
              </p>
            </div>
          )}

          {/* RNNoise Toggle */}
          <div className="rnnoise-section">
            <div className="rnnoise-info">
              <Settings2 size={18} />
              <div>
                <span className="rnnoise-title">{t("RNNoise AI")}</span>
                <span className="rnnoise-desc">{t("AI noise suppression")}</span>
              </div>
            </div>
            <button 
              className={`toggle-btn ${rnnoiseEnabled ? 'active' : ''}`}
              onClick={handleRNNoiseToggle}
            >
              {rnnoiseEnabled ? <Check size={16} /> : <span className="dot" />}
              {rnnoiseEnabled ? t("Active") : t("Inactive")}
            </button>
          </div>

          {/* Presets Grid */}
          <div className="presets-section">
            <h3>{t("Effect Presets")}</h3>
            <div className="presets-grid">
              {presets.map(preset => {
                const Icon = PRESET_ICONS[preset.id] || Mic;
                const isActive = currentPreset === preset.id;
                
                return (
                  <button
                    key={preset.id}
                    className={`preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handlePresetChange(preset.id)}
                  >
                    <div className="preset-icon">
                      <Icon size={24} />
                    </div>
                    <div className="preset-info">
                      <span className="preset-name">{preset.name}</span>
                      <span className="preset-desc">{preset.description}</span>
                    </div>
                    {isActive && <div className="active-indicator" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Effect Info */}
          {currentPreset !== 'none' && (
            <div className="current-effect-info">
              <div className="effect-badge">
                <Sparkles size={14} />
                <span>{presets.find(p => p.id === currentPreset)?.name}</span>
              </div>
              <span className="effect-status">{t("Effect active")}</span>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <p className="footer-note">
            {t("Powered by Web Audio API + WebAssembly")}
          </p>
        </div>
      </div>
    </div>
  );
}