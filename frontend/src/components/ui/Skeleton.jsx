import { useT } from "../../context/LocaleContext";

export function SkeletonLine({ width = "100%", height = 12, circle = false }) {
  return (
    <div
      className="skeleton-line"
      style={{
        width,
        height: circle ? width : height,
        borderRadius: circle ? "50%" : undefined,
      }}
    />
  );
}

/** Replaces blank/spinner message loading states */
export function MessageSkeleton({ count = 6 }) {
  const t = useT();
  return (
    <div className="skeleton-messages" aria-busy="true" aria-label={t("Loading messages")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonLine width={40} circle />
          <div className="skeleton-col">
            <SkeletonLine width={`${28 + (i % 3) * 10}%`} />
            <SkeletonLine width={`${70 + (i % 4) * 6}%`} />
            {i % 2 === 0 && <SkeletonLine width={`${48 + (i % 3) * 8}%`} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Sidebar DM / group conversation-row placeholders — same shimmer language
 * as MessageSkeleton, sized like `.conv-row` / `.dm-item`.
 */
export function ConversationListSkeleton({ count = 6, label }) {
  const t = useT();
  return (
    <div
      className="skeleton-conversations"
      aria-busy="true"
      aria-label={label || t("Loading conversations")}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-conv-row">
          <SkeletonLine width={40} circle />
          <div className="skeleton-conv-body">
            <div className="skeleton-conv-top">
              <SkeletonLine width={`${42 + (i % 4) * 8}%`} height={12} />
              <SkeletonLine width={28 + (i % 3) * 4} height={10} />
            </div>
            <SkeletonLine width={`${58 + (i % 5) * 7}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Servers list placeholders — same shimmer as ConversationListSkeleton,
 * sized like `.server-list-item` (40×40 squircle icon + name/subtitle).
 */
export function ServerListSkeleton({ count = 6, label }) {
  const t = useT();
  return (
    <div
      className="skeleton-server-list"
      aria-busy="true"
      aria-label={label || t("Loading servers")}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-server-row">
          <div className="skeleton-line skeleton-server-icon" />
          <div className="skeleton-server-body">
            <SkeletonLine width={`${46 + (i % 4) * 9}%`} height={13} />
            <SkeletonLine width={`${34 + (i % 3) * 8}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
