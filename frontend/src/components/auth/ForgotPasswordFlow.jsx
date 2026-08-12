import { useState } from "react";
import { Lock, Mail, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import { requestPasswordReset, confirmPasswordReset } from "../../api/auth";
import { useT } from "../../context/LocaleContext";

const SUPPORT_EMAIL = "support@descall.com";

/**
 * Shared forgot-password wizard for AuthView / marketing login.
 * Steps: identify → code+new password → done | no_email
 */
export default function ForgotPasswordFlow({ onBack, className = "", variant = "auth" }) {
  const t = useT();
  const [step, setStep] = useState("identify"); // identify | code | done | no_email
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [supportEmail, setSupportEmail] = useState(SUPPORT_EMAIL);
  const [info, setInfo] = useState("");

  const sendCode = async (event) => {
    event?.preventDefault?.();
    const id = usernameOrEmail.trim();
    if (!id || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const data = await requestPasswordReset(id);
      if (data?.status === "no_email") {
        setSupportEmail(data.supportEmail || SUPPORT_EMAIL);
        setStep("no_email");
        return;
      }
      if (data?.status === "not_found") {
        setError(data.error || t("No account found with that username."));
        return;
      }
      if (data?.status === "cooldown") {
        setHint(data?.emailHint || "");
        setInfo(data?.message || t("A code was just sent. Wait a minute before requesting another."));
        setStep("code");
        return;
      }
      setHint(data?.emailHint || "");
      setInfo(data?.message || t("We sent a 6-digit code to your email."));
      setStep("code");
    } catch (err) {
      const body = err?.body || {};
      if (body.status === "no_email") {
        setSupportEmail(body.supportEmail || SUPPORT_EMAIL);
        setStep("no_email");
        return;
      }
      setError(err?.message || body.error || t("Could not send reset code."));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (newPassword !== confirm) {
      setError(t("Passwords do not match."));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("Password must be at least 6 characters."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await confirmPasswordReset({
        usernameOrEmail: usernameOrEmail.trim(),
        code: code.trim(),
        newPassword,
      });
      setStep("done");
    } catch (err) {
      setError(err?.message || t("Could not reset password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`forgot-password-flow forgot-password-flow--${variant} ${className}`.trim()}>
      {step === "identify" && (
        <form onSubmit={sendCode} className="auth-form">
          <p className="auth-field-hint" style={{ marginTop: 0 }}>
            {t("Enter your username or email. We’ll send a 6-digit code to the email on your account.")}
          </p>
          <div className="input-wrapper">
            <Mail className="input-icon" size={20} />
            <input
              type="text"
              autoComplete="username"
              placeholder={t("Username or email")}
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              maxLength={254}
              autoFocus
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="auth-submit" disabled={busy || !usernameOrEmail.trim()}>
            {busy ? t("Please wait...") : t("Send reset code")}
          </button>
          <button type="button" className="auth-tab auth-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>{t("Back to login")}</span>
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitReset} className="auth-form">
          <p className="auth-field-hint" style={{ marginTop: 0 }}>
            {hint
              ? t("Enter the code we sent to {email}", { email: hint })
              : t("Enter the 6-digit code from your email, then choose a new password.")}
          </p>
          {info && <p className="auth-success-hint">{info}</p>}
          <div className="input-wrapper">
            <ShieldCheck className="input-icon" size={20} />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("6-digit code")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <div className="input-wrapper">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t("New password")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={72}
              required
            />
          </div>
          <div className="input-wrapper">
            <KeyRound className="input-icon" size={20} />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t("Confirm new password")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={72}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button
            type="submit"
            className="auth-submit"
            disabled={busy || code.length !== 6 || !newPassword || !confirm}
          >
            {busy ? t("Please wait...") : t("Reset password")}
          </button>
          <button type="button" className="us-link-btn auth-resend-link" onClick={sendCode} disabled={busy}>
            {t("Resend code")}
          </button>
          <button type="button" className="auth-tab auth-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>{t("Back to login")}</span>
          </button>
        </form>
      )}

      {step === "no_email" && (
        <div className="auth-form">
          <div className="auth-support-card">
            <Mail size={22} />
            <h3>{t("No email on this account")}</h3>
            <p>
              {t(
                "This account doesn’t have an email address, so we can’t send a reset code. Contact support and we’ll help you recover access."
              )}
            </p>
            <a className="auth-support-link" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </div>
          <button type="button" className="auth-tab auth-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>{t("Back to login")}</span>
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="auth-form">
          <div className="auth-support-card auth-success-card">
            <ShieldCheck size={22} />
            <h3>{t("Password updated")}</h3>
            <p>{t("You can now sign in with your new password.")}</p>
          </div>
          <button type="button" className="auth-submit" onClick={onBack}>
            {t("Back to login")}
          </button>
        </div>
      )}
    </div>
  );
}
