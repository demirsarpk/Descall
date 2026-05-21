import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Modern Voice Recorder Hook
 * - Records audio from microphone
 * - Returns blob and duration
 * - Supports start, stop, cancel, and reset operations
 */
export function useVoiceRecorder({ onRecordingComplete } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [formattedDuration, setFormattedDuration] = useState("0:00");
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isActiveRef = useRef(false);

  // Check for MediaRecorder support
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setIsSupported(false);
      setError("Voice recording is not supported in this browser");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser");
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];
      setRecordingBlob(null);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        } 
      });
      
      streamRef.current = stream;

      // Determine best audio format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      isActiveRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordingBlob(blob);
        
        const duration = recordingDurationRef.current;
        setRecordingDuration(duration);
        setFormattedDuration(formatTime(duration));

        if (onRecordingComplete && isActiveRef.current) {
          onRecordingComplete(blob, duration);
        }

        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        isActiveRef.current = false;
      };

      recorder.onerror = () => {
        setError("Recording error occurred");
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        isActiveRef.current = false;
      };

      // Start recording with timeslice for better chunking
      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      startTimeRef.current = Date.now();

      // Start duration timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
        setFormattedDuration(formatTime(elapsed));
      }, 100);

    } catch (err) {
      console.error("[VoiceRecorder] Start recording failed:", err);
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError(`Failed to start recording: ${err.message}`);
      }
      setIsRecording(false);
      isActiveRef.current = false;
    }
  }, [onRecordingComplete, isSupported]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    isActiveRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    chunksRef.current = [];
    setRecordingBlob(null);
    setRecordingDuration(0);
    setFormattedDuration("0:00");
    setIsRecording(false);
  }, []);

  const resetRecording = useCallback(() => {
    chunksRef.current = [];
    setRecordingBlob(null);
    setRecordingDuration(0);
    setFormattedDuration("0:00");
    setIsRecording(false);
  }, []);

  const recordingDurationRef = useRef(recordingDuration);
  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  return {
    isRecording,
    recordingDuration,
    recordingBlob,
    formattedDuration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  };
}