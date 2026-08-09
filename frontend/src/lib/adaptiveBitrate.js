/**
 * Adaptive bitrate/resolution encoding profiles for outgoing camera video,
 * driven by the live connection-quality bucket from connectionStats.js.
 * Screen share has its own tuning (webrtcScreenShare.js) since it prioritizes
 * sharpness over resolution scaling.
 */

const VIDEO_ENCODING_PROFILES = {
  excellent: { maxBitrate: 2_500_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
  good: { maxBitrate: 1_500_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
  fair: { maxBitrate: 800_000, scaleResolutionDownBy: 2, maxFramerate: 24 },
  poor: { maxBitrate: 300_000, scaleResolutionDownBy: 4, maxFramerate: 15 },
};

const AUDIO_ENCODING_PROFILES = {
  excellent: { maxBitrate: 64_000 },
  good: { maxBitrate: 48_000 },
  fair: { maxBitrate: 32_000 },
  poor: { maxBitrate: 20_000 },
};

export function getAdaptiveVideoEncodingParams(quality) {
  return VIDEO_ENCODING_PROFILES[quality] || VIDEO_ENCODING_PROFILES.good;
}

export function getAdaptiveAudioEncodingParams(quality) {
  return AUDIO_ENCODING_PROFILES[quality] || AUDIO_ENCODING_PROFILES.good;
}

/**
 * Apply the encoding profile for `quality` to an RTCRtpSender carrying a
 * camera video track. No-ops when nothing changed to avoid spamming
 * setParameters() (which is not free — some browsers reset stats on call).
 */
export async function applyAdaptiveVideoEncoding(sender, quality, lastAppliedRef) {
  if (!sender || !sender.track || sender.track.kind !== "video") return;
  const profile = getAdaptiveVideoEncodingParams(quality);
  if (lastAppliedRef && lastAppliedRef.current === quality) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    const enc = params.encodings[0];
    enc.maxBitrate = profile.maxBitrate;
    enc.scaleResolutionDownBy = profile.scaleResolutionDownBy;
    enc.maxFramerate = profile.maxFramerate;
    params.degradationPreference = "balanced";
    await sender.setParameters(params);
    if (lastAppliedRef) lastAppliedRef.current = quality;
  } catch (err) {
    console.warn("[AdaptiveBitrate] video setParameters failed:", err?.message || err);
  }
}

/** Same idea for the microphone audio sender — trims bitrate under duress. */
export async function applyAdaptiveAudioEncoding(sender, quality, lastAppliedRef) {
  if (!sender || !sender.track || sender.track.kind !== "audio") return;
  const profile = getAdaptiveAudioEncodingParams(quality);
  if (lastAppliedRef && lastAppliedRef.current === quality) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    const enc = params.encodings[0];
    enc.maxBitrate = profile.maxBitrate;
    await sender.setParameters(params);
    if (lastAppliedRef) lastAppliedRef.current = quality;
  } catch (err) {
    console.warn("[AdaptiveBitrate] audio setParameters failed:", err?.message || err);
  }
}
