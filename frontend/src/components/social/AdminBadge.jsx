import { Shield } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { isUserAdmin } from "../../lib/userProfile";
import "./AdminBadge.css";

/**
 * Polished staff/admin badge — inline (chat), chip (profile/hover), mark (avatar corner).
 */
export default function AdminBadge({
  user,
  force = false,
  variant = "inline",
  className = "",
  title,
}) {
  const t = useT();
  if (!force && !isUserAdmin(user)) return null;

  const label = t("Admin");
  const tip = title || t("Descall staff");
  const classes = ["dsc-admin-badge", `dsc-admin-badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (variant === "mark") {
    return (
      <span className={classes} title={tip} aria-label={label}>
        <Shield size={10} strokeWidth={2.4} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={classes} title={tip} aria-label={label}>
      <Shield size={variant === "chip" ? 12 : 11} strokeWidth={2.4} aria-hidden="true" />
      <span className="dsc-admin-badge-label">{label}</span>
    </span>
  );
}
