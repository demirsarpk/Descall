export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function historyBucket(ts) {
  const then = startOfDay(new Date(ts || Date.now()));
  if (!Number.isFinite(then)) return "previous";
  const today = startOfDay(new Date());
  const day = 86400000;
  if (then === today) return "today";
  if (then === today - day) return "yesterday";
  return "previous";
}

export function formatRelTime(ts, locale) {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return "";
  const loc = locale === "tr" ? "tr" : "en";
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return new Date(ts).toLocaleDateString(loc, { month: "short", day: "numeric" });
}
