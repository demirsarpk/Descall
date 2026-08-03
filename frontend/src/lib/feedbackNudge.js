/**
 * Soft feedback reminder scheduling — localStorage backed.
 * Designed to stay useful without nagging.
 */

import { t } from "../i18n/runtime";

const STORAGE_KEY = "descall:feedbackNudge:v1";

const DEFAULTS = {
  lastShownAt: 0,
  lastSubmittedAt: 0,
  lastDismissedAt: 0,
  dismissCount: 0,
  lastTrigger: null,
  afterCallCooldownedAt: 0,
  softNudgeCount: 0,
};

/** Cooldowns (ms) */
export const FEEDBACK_COOLDOWN = {
  afterShow: 21 * 24 * 60 * 60 * 1000, // 21 days between soft nudges
  afterSubmit: 90 * 24 * 60 * 60 * 1000, // 90 days after a submission
  afterDismiss: 30 * 24 * 60 * 60 * 1000, // 30 days after dismiss
  afterCallMinSession: 45 * 1000, // only nudge if call lasted ≥45s
  afterCallCooldown: 14 * 24 * 60 * 60 * 1000, // call-end nudge at most every 14 days
  autoHideMs: 10_000,
};

function getCopy(key) {
  const copies = {
    soft: {
      title: t("Got an idea or bug?"),
      body: t("Send a short note to help us improve Descall."),
      cta: t("Send feedback"),
      type: "suggestion",
    },
    after_call: {
      title: t("How was the call?"),
      body: t("If audio/video quality or anything else was off — tell us. 30 seconds is enough."),
      cta: t("Give feedback"),
      type: "bug",
    },
    after_call_good: {
      title: t("Call ended — anything to say?"),
      body: t("Suggestion, request, or bug… all help."),
      cta: t("Open feedback"),
      type: "suggestion",
    },
  };
  return copies[key] || copies.soft;
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeState(patch) {
  const next = { ...readState(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function markFeedbackSubmitted() {
  writeState({ lastSubmittedAt: Date.now() });
}

export function markFeedbackNudgeDismissed() {
  const s = readState();
  writeState({
    lastDismissedAt: Date.now(),
    dismissCount: (s.dismissCount || 0) + 1,
  });
}

export function markFeedbackNudgeShown(trigger) {
  writeState({
    lastShownAt: Date.now(),
    lastTrigger: trigger || "soft",
    softNudgeCount: (readState().softNudgeCount || 0) + 1,
    ...(trigger === "after_call" ? { afterCallCooldownedAt: Date.now() } : {}),
  });
}

function canShowNow(state, { ignoreSoftCooldown = false } = {}) {
  const now = Date.now();
  if (state.lastSubmittedAt && now - state.lastSubmittedAt < FEEDBACK_COOLDOWN.afterSubmit) {
    return false;
  }
  if (state.lastDismissedAt && now - state.lastDismissedAt < FEEDBACK_COOLDOWN.afterDismiss) {
    return false;
  }
  if (
    !ignoreSoftCooldown &&
    state.lastShownAt &&
    now - state.lastShownAt < FEEDBACK_COOLDOWN.afterShow
  ) {
    return false;
  }
  return true;
}

/**
 * @returns {{ show: boolean, payload: object|null }}
 */
export function evaluateSoftNudge() {
  const state = readState();
  if (!canShowNow(state)) return { show: false, payload: null };
  // First soft nudge only after user has been around a bit — caller should also gate on session age
  return { show: true, payload: { trigger: "soft", ...getCopy("soft") } };
}

/**
 * Call ended — may show sooner than soft cooldown, but still respects submit/dismiss cooldowns
 * and its own 14-day call cooldown. Requires callDurationMs ≥ 45s.
 */
export function evaluateAfterCallNudge(callDurationMs = 0) {
  const state = readState();
  if (callDurationMs < FEEDBACK_COOLDOWN.afterCallMinSession) {
    return { show: false, payload: null };
  }
  if (!canShowNow(state, { ignoreSoftCooldown: true })) {
    return { show: false, payload: null };
  }
  if (
    state.afterCallCooldownedAt &&
    Date.now() - state.afterCallCooldownedAt < FEEDBACK_COOLDOWN.afterCallCooldown
  ) {
    return { show: false, payload: null };
  }
  // Alternate copy slightly
  const copyKey = (state.softNudgeCount || 0) % 2 === 0 ? "after_call" : "after_call_good";
  return { show: true, payload: { trigger: "after_call", ...getCopy(copyKey) } };
}

export function getFeedbackNudgeCopy(trigger) {
  return getCopy(trigger);
}

export function openFeedbackModal(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("descall:open-feedback", {
        detail: {
          type: detail.type || "suggestion",
          source: detail.source || "nudge",
        },
      })
    );
  } catch {
    /* ignore */
  }
}
