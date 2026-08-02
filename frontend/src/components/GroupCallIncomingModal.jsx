import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import IncomingCallCard from "./voice/IncomingCallCard";

/**
 * Floating incoming group call modal — FaceTime-style avatar rings.
 */
export default function GroupCallIncomingModal({ incomingCall, onAccept, onDecline }) {
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(
      () =>
        onDecline?.(
          incomingCall.groupId,
          incomingCall.fromUser?.id,
          incomingCall.fromUser,
          incomingCall.callType
        ),
      30_000
    );
    return () => clearTimeout(timer);
  }, [incomingCall, onDecline]);

  return (
    <AnimatePresence>
      {incomingCall && (
        <IncomingCallCard
          key="group-incoming-call"
          username={incomingCall.fromUser?.username}
          user={incomingCall.fromUser}
          callType={incomingCall.callType}
          isGroup
          subtitle="Group call"
          onDecline={() =>
            onDecline?.(
              incomingCall.groupId,
              incomingCall.fromUser?.id,
              incomingCall.fromUser,
              incomingCall.callType
            )
          }
          onAccept={() =>
            onAccept?.(incomingCall.groupId, incomingCall.callType, incomingCall.fromUser)
          }
        />
      )}
    </AnimatePresence>
  );
}
