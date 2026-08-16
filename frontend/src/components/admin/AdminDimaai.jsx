import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Trash2,
  Star,
  Power,
  PowerOff,
  FlaskConical,
  ChevronUp,
  ChevronDown,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  EyeOff,
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import RippleButton from "../ui/RippleButton";
import { useT } from "../../context/LocaleContext";

function errorLabel(code, t) {
  if (!code) return "—";
  const translated = t(`admin.dimaai.errorCode.${code}`);
  if (!translated || translated.startsWith("admin.dimaai.errorCode.")) return code;
  return translated;
}

function fmt(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

export default function AdminDimaai() {
  const t = useT();
  const [keys, setKeys] = useState([]);
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [testingId, setTestingId] = useState(null);

  const load = useCallback(async () => {
    const data = await adminFetch("/dimaai/keys");
    setKeys(data.keys || []);
    setCounts(data.counts || null);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const act = async (fn, successMsg) => {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await fn();
      await load();
      if (successMsg) setOk(successMsg);
    } catch (e) {
      setErr(e.message || t("admin.dimaai.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const addKey = (e) => {
    e.preventDefault();
    const raw = secret.trim();
    if (raw.length < 20) {
      setErr(t("admin.dimaai.keyIncomplete"));
      return;
    }
    act(async () => {
      await adminFetch("/dimaai/keys", {
        method: "POST",
        body: JSON.stringify({ label: label.trim() || "Provider key", secret: raw }),
      });
      setLabel("");
      setSecret("");
    }, t("admin.dimaai.keyAdded"));
  };

  const patch = (id, body, msg) =>
    act(
      () => adminFetch(`/dimaai/keys/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
      msg,
    );

  const remove = (id) => {
    if (!window.confirm(t("admin.dimaai.confirmDelete"))) return;
    act(
      () => adminFetch(`/dimaai/keys/${id}`, { method: "DELETE" }),
      t("admin.dimaai.keyRemoved"),
    );
  };

  const test = async (id) => {
    setTestingId(id);
    setErr("");
    setOk("");
    try {
      const data = await adminFetch(`/dimaai/keys/${encodeURIComponent(id)}/test`, { method: "POST" });
      if (data.ok) setOk(t("admin.dimaai.testOk"));
      else setErr(data.code ? t(`admin.dimaai.testCode.${data.code}`) : (data.error || t("admin.dimaai.testFail")));
      await load();
    } catch (e) {
      setErr(e.message || t("admin.dimaai.testFail"));
    } finally {
      setTestingId(null);
    }
  };

  const move = (index, dir) => {
    const db = keys.filter((k) => k.source === "database");
    const env = keys.filter((k) => k.source !== "database");
    const next = [...db];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    act(
      () =>
        adminFetch("/dimaai/keys/reorder", {
          method: "POST",
          body: JSON.stringify({ ids: next.map((k) => k.id) }),
        }),
      t("admin.dimaai.orderSaved"),
    );
    setKeys([...next, ...env]);
  };

  const dbKeys = keys.filter((k) => k.source === "database");
  const envKeys = keys.filter((k) => k.source === "environment");

  return (
    <section className="admin-section admin-section-full dima-admin">
      <div className="dima-admin-head">
        <div>
          <h2>
            <Sparkles size={20} /> DimaAI
          </h2>
          <p className="muted">{t("admin.dimaai.subtitle")}</p>
        </div>
        <RippleButton type="button" onClick={() => act(load)} disabled={busy}>
          <RefreshCw size={14} /> {t("common.refresh")}
        </RippleButton>
      </div>

      <div className="dima-admin-stats">
        <div className="dima-admin-stat">
          <KeyRound size={16} />
          <strong>{counts?.database ?? dbKeys.length}</strong>
          <span>{t("admin.dimaai.savedKeys")}</span>
        </div>
        <div className="dima-admin-stat">
          <CheckCircle2 size={16} />
          <strong>{keys.filter((k) => k.available).length}</strong>
          <span>{t("admin.dimaai.available")}</span>
        </div>
        <div className="dima-admin-stat">
          <Shield size={16} />
          <strong>{envKeys.length}</strong>
          <span>{t("admin.dimaai.envKeys")}</span>
        </div>
      </div>

      <div className="dima-admin-note">
        <EyeOff size={14} />
        {t("admin.dimaai.privacyNote")}
      </div>

      {err && (
        <div className="dima-admin-banner is-err" role="alert">
          <AlertTriangle size={14} /> {err}
        </div>
      )}
      {ok && (
        <div className="dima-admin-banner is-ok">
          <CheckCircle2 size={14} /> {ok}
        </div>
      )}

      <form className="dima-admin-add" onSubmit={addKey}>
        <h3>
          <Plus size={16} /> {t("admin.dimaai.addKey")}
        </h3>
        <p className="muted">{t("admin.dimaai.addHint")}</p>
        <div className="dima-admin-add-row">
          <input
            className="dima-admin-input"
            placeholder={t("admin.dimaai.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
          />
          <input
            className="dima-admin-input"
            type="password"
            autoComplete="off"
            placeholder={t("admin.dimaai.secretPlaceholder")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <RippleButton type="submit" className="admin-btn-green" disabled={busy || secret.trim().length < 20}>
            <Plus size={14} /> {t("admin.dimaai.saveKey")}
          </RippleButton>
        </div>
      </form>

      <h3>{t("admin.dimaai.pool")}</h3>
      {dbKeys.length === 0 && (
        <p className="muted">{t("admin.dimaai.emptyPool")}</p>
      )}
      <div className="dima-admin-table-wrap">
        {dbKeys.map((k, index) => (
          <article key={k.id} className={`dima-admin-key ${k.enabled ? "" : "is-off"}${k.isPreferred ? " is-preferred" : ""}`}>
            <div className="dima-admin-key-top">
              <div className="dima-admin-key-title">
                <span className="dima-admin-key-mark" aria-hidden="true">
                  {k.isPreferred ? <Star size={16} /> : <KeyRound size={16} />}
                </span>
                <div className="dima-admin-key-id">
                  <strong>{k.label}</strong>
                  <code>{k.mask}</code>
                </div>
              </div>
              <span className={`dima-admin-pill ${k.available ? "ok" : "bad"}`}>
                {k.available ? t("admin.dimaai.available") : t("admin.dimaai.unavailable")}
              </span>
            </div>
            <div className="dima-admin-key-meta">
              <span>
                <Clock size={12} /> {t("admin.dimaai.lastOk")}: {fmt(k.lastOkAt)}
              </span>
              <span>
                {k.lastError ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                {t("admin.dimaai.lastError")}: {errorLabel(k.lastError, t)}
              </span>
              <span>{t("admin.dimaai.order")}: {index + 1}</span>
            </div>
            <div className="dima-admin-key-actions">
              <button type="button" className="dima-admin-action is-test" disabled={busy || testingId === k.id} onClick={() => test(k.id)}>
                <FlaskConical size={14} /> {testingId === k.id ? t("common.loading") : t("admin.dimaai.test")}
              </button>
              <button type="button" className="dima-admin-action" disabled={busy} onClick={() => patch(k.id, { isPreferred: true }, t("admin.dimaai.preferredSet"))}>
                <Star size={14} /> {t("admin.dimaai.setPreferred")}
              </button>
              <button type="button" className="dima-admin-action" disabled={busy} onClick={() => patch(k.id, { enabled: !k.enabled })}>
                {k.enabled ? <PowerOff size={14} /> : <Power size={14} />}
                {k.enabled ? t("admin.dimaai.disable") : t("admin.dimaai.enable")}
              </button>
              <button type="button" className="dima-admin-action" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                <ChevronUp size={14} /> {t("admin.dimaai.moveUp")}
              </button>
              <button type="button" className="dima-admin-action" disabled={busy || index === dbKeys.length - 1} onClick={() => move(index, 1)}>
                <ChevronDown size={14} /> {t("admin.dimaai.moveDown")}
              </button>
              <button type="button" className="dima-admin-action is-danger" disabled={busy} onClick={() => remove(k.id)}>
                <Trash2 size={14} /> {t("common.delete")}
              </button>
            </div>
          </article>
        ))}
      </div>

      {envKeys.length > 0 && (
        <>
          <h3>{t("admin.dimaai.envSection")}</h3>
          <p className="muted">{t("admin.dimaai.envHint")}</p>
          {envKeys.map((k) => (
            <article key={k.id} className="dima-admin-key is-env">
              <div className="dima-admin-key-top">
                <div className="dima-admin-key-title">
                  <span className="dima-admin-key-mark" aria-hidden="true">
                    <KeyRound size={16} />
                  </span>
                  <div className="dima-admin-key-id">
                    <strong>{k.label}</strong>
                    <code>{k.mask}</code>
                  </div>
                </div>
                <span className="dima-admin-pill ok">{t("admin.dimaai.readOnly")}</span>
              </div>
              <div className="dima-admin-key-actions">
                <button type="button" className="dima-admin-action is-test" disabled={testingId === k.id} onClick={() => test(k.id)}>
                  <FlaskConical size={14} /> {t("admin.dimaai.test")}
                </button>
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
