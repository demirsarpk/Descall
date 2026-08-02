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
  return (
    <div className="skeleton-messages" aria-busy="true" aria-label="Loading messages">
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
