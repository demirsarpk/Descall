import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * Valorant party code — click to reveal + copy (members only).
 */
export default function PartyCodeReveal({
  code,
  hasCode,
  canEdit = false,
  onSave,
  disabled = false,
}) {
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code || "");
  const [saving, setSaving] = useState(false);

  const value = code || "";
  const showValue = revealed ? value : "••••••••";

  const copy = async () => {
    if (!value) return;
    if (!revealed) setRevealed(true);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
      setRevealed(true);
    } finally {
      setSaving(false);
    }
  };

  if (editing && canEdit) {
    return (
      <div className="lfg-party-code is-editing">
        <label>{t("Valorant party code")}</label>
        <div className="lfg-party-code-row">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("Paste party code")}
            maxLength={32}
            autoFocus
          />
          <button type="button" className="lfg-btn primary" onClick={save} disabled={saving}>
            {saving ? "…" : t("Save")}
          </button>
          <button type="button" className="lfg-btn ghost" onClick={() => setEditing(false)}>
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (!hasCode && !value) {
    return (
      <div className="lfg-party-code is-empty">
        <label>{t("Valorant party code")}</label>
        <p>{t("Host hasn’t added a party code yet.")}</p>
        {canEdit && (
          <button type="button" className="lfg-btn primary" onClick={() => setEditing(true)} disabled={disabled}>
            {t("Set party code")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="lfg-party-code">
      <label>{t("Valorant party code")}</label>
      <div className="lfg-party-code-row">
        <button
          type="button"
          className={`lfg-party-code-mask ${revealed ? "is-revealed" : ""}`}
          onClick={() => setRevealed((v) => !v)}
          title={revealed ? t("Hide") : t("Click to reveal")}
        >
          <span className="lfg-party-code-value">{showValue}</span>
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          <em>{revealed ? t("Hide") : t("Click to reveal")}</em>
        </button>
        <button
          type="button"
          className={`lfg-btn ${copied ? "success" : "primary"}`}
          onClick={copy}
          disabled={!value}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t("Copied") : t("Copy")}
        </button>
        {canEdit && (
          <button type="button" className="lfg-btn ghost" onClick={() => { setDraft(value); setEditing(true); }}>
            {t("Edit")}
          </button>
        )}
      </div>
      <p className="lfg-party-code-hint">{t("Paste in Valorant → Social → Party invite code")}</p>
    </div>
  );
}
