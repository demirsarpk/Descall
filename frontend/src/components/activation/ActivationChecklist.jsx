import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Phone, Sparkles, UserPlus, X, Gift } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { Funnel } from "../../site/analytics";
import InviteCard from "../friends/InviteCard";
import {
  ACTIVATION_EVENTS,
  ACTIVATION_STEP_META,
  ACTIVATION_STEPS,
  activationCompletedCount,
  dismissActivation,
  emitActivationEvent,
  isActivationComplete,
  loadActivationProgress,
  markActivationStep,
  openActivation,
  shouldShowActivation,
} from "../../lib/activationProgress";
import "./ActivationChecklist.css";

const STEP_ICONS = {
  invite: Gift,
  friend: UserPlus,
  call: Phone,
};

/**
 * Post-register activation rail — invite → add friend → first voice call.
 */
export default function ActivationChecklist({
  me,
  friends = [],
  onlineUsers = [],
  justRegistered = false,
  isInCall = false,
  onNavigateFriends,
  onNavigateCalls,
  onStartVoiceWithFriend,
}) {
  const t = useT();
  const userId = me?.id;
  const [state, setState] = useState(() => loadActivationProgress(userId));
  const [expanded, setExpanded] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const shownRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setState(loadActivationProgress(userId));
    shownRef.current = false;
    completedRef.current = false;
    setCelebrate(false);
  }, [userId]);

  const visible = useMemo(
    () =>
      shouldShowActivation({
        userId,
        friendsCount: Array.isArray(friends) ? friends.length : 0,
        justRegistered,
      }) && !celebrate,
    [userId, friends, justRegistered, state.dismissed, state.completed, celebrate]
  );

  useEffect(() => {
    if (!userId || !visible) return;
    const next = openActivation(userId);
    setState(next);
    if (!shownRef.current) {
      shownRef.current = true;
      Funnel.activationShown({
        just_registered: Boolean(justRegistered),
        completed: activationCompletedCount(next),
      });
    }
  }, [userId, visible, justRegistered]);

  // Auto-complete friend step when they already have friends.
  useEffect(() => {
    if (!userId || !visible) return;
    if ((friends?.length || 0) > 0 && !state.completed.friend) {
      const next = markActivationStep(userId, "friend");
      setState(next);
      Funnel.activationStepComplete({ step: "friend", source: "auto_friends" });
      if (isActivationComplete(next)) {
        Funnel.activationComplete({ source: "auto_friends" });
      }
    }
  }, [userId, visible, friends, state.completed.friend]);

  // Complete call step only once a real call is active.
  useEffect(() => {
    if (!userId || !visible) return;
    if (isInCall && !state.completed.call) {
      const next = markActivationStep(userId, "call");
      setState(next);
      Funnel.activationStepComplete({ step: "call", source: "in_call" });
      if (isActivationComplete(next)) {
        Funnel.activationComplete({ source: "in_call" });
      }
    }
  }, [userId, visible, isInCall, state.completed.call]);

  useEffect(() => {
    const onProgress = (e) => {
      const step = e?.detail?.step;
      if (!userId || !step) return;
      const next = markActivationStep(userId, step);
      setState({ ...next });
      Funnel.activationStepComplete({ step, source: e?.detail?.source || "event" });
      if (isActivationComplete(next)) {
        Funnel.activationComplete({ source: e?.detail?.source || "event" });
      }
    };
    window.addEventListener(ACTIVATION_EVENTS.PROGRESS, onProgress);
    return () => window.removeEventListener(ACTIVATION_EVENTS.PROGRESS, onProgress);
  }, [userId]);

  const completeStep = useCallback(
    (step, source) => {
      if (!userId) return;
      const next = markActivationStep(userId, step);
      setState({ ...next });
      Funnel.activationStepComplete({ step, source });
      if (isActivationComplete(next)) {
        Funnel.activationComplete({ source });
      }
    },
    [userId]
  );

  const handleDismiss = useCallback(() => {
    if (!userId) return;
    const next = dismissActivation(userId);
    setState(next);
    setCelebrate(false);
    Funnel.activationDismissed({ completed: activationCompletedCount(next) });
  }, [userId]);

  // Celebrate then auto-dismiss when all three steps are done.
  useEffect(() => {
    if (!userId || state.dismissed) return;
    if (!isActivationComplete(state) || completedRef.current) return;
    completedRef.current = true;
    setCelebrate(true);
    setExpanded(true);
    const timer = window.setTimeout(() => handleDismiss(), 3200);
    return () => window.clearTimeout(timer);
  }, [userId, state, handleDismiss]);

  const onlineFriend = useMemo(() => {
    const list = Array.isArray(friends) ? friends : [];
    const online = Array.isArray(onlineUsers) ? onlineUsers : [];
    return list.find((f) =>
      online.some((u) => String(u?.id || u) === String(f.id) && isVisiblyOnlineish(u))
    ) || list[0] || null;
  }, [friends, onlineUsers]);

  if ((!visible && !celebrate) || !me?.username) return null;

  const done = activationCompletedCount(state);
  const total = ACTIVATION_STEPS.length;
  const pct = Math.round((done / total) * 100);

  const runStep = (stepId) => {
    if (stepId === "invite") {
      setInviteOpen(true);
      setExpanded(true);
      emitActivationEvent(ACTIVATION_EVENTS.OPEN_INVITE);
      return;
    }
    if (stepId === "friend") {
      onNavigateFriends?.();
      emitActivationEvent(ACTIVATION_EVENTS.OPEN_ADD_FRIEND, { tab: "quickadd" });
      return;
    }
    if (stepId === "call") {
      if (onlineFriend && onStartVoiceWithFriend) {
        onStartVoiceWithFriend(onlineFriend);
        return;
      }
      if (onNavigateCalls) onNavigateCalls();
      else onNavigateFriends?.();
      emitActivationEvent(ACTIVATION_EVENTS.START_VOICE);
    }
  };

  return (
    <aside
      className={`activation-rail${expanded ? " is-expanded" : ""}${celebrate ? " is-complete" : ""}${inviteOpen && expanded ? " has-invite" : ""}`}
      aria-label={t("Get started")}
    >
      <header className="activation-rail-head">
        <button
          type="button"
          className="activation-rail-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Sparkles size={16} aria-hidden />
          <div className="activation-rail-titles">
            <strong>{celebrate ? t("You're ready") : t("Get started on Descall")}</strong>
            <span>
              {celebrate
                ? t("Invite, friend, and first call — done.")
                : `${t("{done} of {total} complete", { done, total })} · ${pct}%`}
            </span>
          </div>
        </button>
        <button
          type="button"
          className="activation-rail-close"
          onClick={handleDismiss}
          aria-label={t("Dismiss")}
        >
          <X size={16} />
        </button>
      </header>

      <div className="activation-rail-progress" aria-hidden>
        <div className="activation-rail-progress-bar" style={{ width: `${celebrate ? 100 : pct}%` }} />
      </div>

      {expanded && !celebrate && (
        <ol className="activation-rail-steps">
          {ACTIVATION_STEPS.map((id) => {
            const Icon = STEP_ICONS[id];
            const meta = ACTIVATION_STEP_META[id];
            const completed = Boolean(state.completed[id]);
            return (
              <li key={id} className={`activation-step${completed ? " is-done" : ""}`}>
                <div className="activation-step-icon" aria-hidden>
                  {completed ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <div className="activation-step-copy">
                  <strong>{t(meta.title)}</strong>
                  <p>{t(meta.body)}</p>
                </div>
                {!completed && (
                  <button type="button" className="activation-step-cta" onClick={() => runStep(id)}>
                    {id === "invite" ? t("Share") : id === "friend" ? t("Add") : t("Call")}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {expanded && inviteOpen && !celebrate && (
        <div className="activation-invite-panel">
          <InviteCard
            username={me.username}
            compact
            onCopied={() => completeStep("invite", "invite_card_copy")}
            onShared={() => completeStep("invite", "invite_card_share")}
          />
        </div>
      )}
    </aside>
  );
}

function isVisiblyOnlineish(userOrId) {
  if (userOrId == null) return false;
  if (typeof userOrId === "string" || typeof userOrId === "number") return true;
  const status = String(userOrId.status || userOrId.presence || "").toLowerCase();
  if (!status) return true;
  return status !== "offline" && status !== "invisible";
}
