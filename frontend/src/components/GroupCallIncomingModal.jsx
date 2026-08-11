import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import IncomingCallCard from "./voice/IncomingCallCard";
import { useT } from "../context/LocaleContext";

/**
 * Floating incoming group call modal — FaceTime-style avatar rings.
 */
export default function GroupCallIncomingModal({ incomingCall, onAccept, onDecline }) {
  const t = useT();
  const onDeclineRef = useRef(onDecline);
  useEffect(() => {
    onDeclineRef.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    if (!incomingCall?.groupId) return;
    const groupId = incomingCall.groupId;
    const fromUser = incomingCall.fromUser;
    const callType = incomingCall.callType;
    const timer = setTimeout(() => {
      onDeclineRef.current?.(groupId, fromUser?.id, fromUser, callType);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [incomingCall?.groupId, incomingCall?.fromUser?.id, incomingCall?.callType]);

  return (
    <AnimatePresence>
      {incomingCall && (
        <IncomingCallCard
          key="group-incoming-call"
          username={incomingCall.fromUser?.username}
          user={incomingCall.fromUser}
          callType={incomingCall.callType}
          isGroup
          subtitle={t("Group call")}
          onDecline={() =>
            onDecline?.(
              incomingCall.groupId,
              incomingCall.fromUser?.id,
              incomingCall.fromUser,
              incomingCall.callType
            )
          }
          onAccept={() =>
            onAccept?.(
              incomingCall.groupId,
              incomingCall.callType,
              incomingCall.fromUser
            )
          }
        />
      )}
    </AnimatePresence>
  );
}
