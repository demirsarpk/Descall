/**
 * First-run activation progress — invite → friend → first voice call.
 * Persisted per user so refresh does not lose checklist state.
 */

const STORAGE_PREFIX = "descall:activation:v1:";

/** @typedef {'invite' | 'friend' | 'call'} ActivationStepId */

/** @type {ActivationStepId[]} */
export const ACTIVATION_STEPS = ["invite", "friend", "call"];

export const ACTIVATION_STEP_META = {
  invite: {
    title: "Invite a friend",
    body: "Share your link — you both earn DesCoin when they join.",
  },
  friend: {
    title: "Add your first friend",
    body: "Quick Add someone you know, or accept an incoming request.",
  },
  call: {
    title: "Start a voice call",
    body: "Hop on a free HD call — the moment Descall feels real.",
  },
};

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId || "anon"}`;
}

function emptyState() {
  return {
    version: 1,
    dismissed: false,
    openedAt: null,
    completed: {
      invite: false,
      friend: false,
      call: false,
    },
  };
}

export function loadActivationProgress(userId) {
  if (!userId || typeof localStorage === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      ...emptyState(),
      ...parsed,
      completed: { ...emptyState().completed, ...(parsed?.completed || {}) },
    };
  } catch {
    return emptyState();
  }
}

export function saveActivationProgress(userId, next) {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function markActivationStep(userId, stepId) {
  if (!ACTIVATION_STEPS.includes(stepId)) return loadActivationProgress(userId);
  const state = loadActivationProgress(userId);
  if (state.completed[stepId]) return state;
  const next = {
    ...state,
    completed: { ...state.completed, [stepId]: true },
  };
  saveActivationProgress(userId, next);
  return next;
}

export function dismissActivation(userId) {
  const state = loadActivationProgress(userId);
  const next = { ...state, dismissed: true };
  saveActivationProgress(userId, next);
  return next;
}

export function openActivation(userId) {
  const state = loadActivationProgress(userId);
  if (state.openedAt) return state;
  const next = { ...state, openedAt: new Date().toISOString(), dismissed: false };
  saveActivationProgress(userId, next);
  return next;
}

export function isActivationComplete(state) {
  return ACTIVATION_STEPS.every((id) => state?.completed?.[id]);
}

export function activationCompletedCount(state) {
  return ACTIVATION_STEPS.filter((id) => state?.completed?.[id]).length;
}

/** Should we show the checklist for this session/user? */
export function shouldShowActivation({ userId, friendsCount = 0, justRegistered = false } = {}) {
  if (!userId) return false;
  const state = loadActivationProgress(userId);
  if (state.dismissed) return false;
  if (isActivationComplete(state)) return false;
  // Always show for fresh signups.
  if (justRegistered || state.openedAt) return true;
  // Soft re-surface for accounts with no friends yet (empty product).
  if (friendsCount === 0 && !state.completed.friend) return true;
  return false;
}

export const ACTIVATION_EVENTS = {
  OPEN_ADD_FRIEND: "descall:activation:open-add-friend",
  OPEN_INVITE: "descall:activation:open-invite",
  START_VOICE: "descall:activation:start-voice",
  PROGRESS: "descall:activation:progress",
};

export function emitActivationEvent(name, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
