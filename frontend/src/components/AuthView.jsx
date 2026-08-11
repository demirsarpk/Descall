import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, UserPlus, Lock, Mail, User, ShieldCheck, ArrowLeft } from "lucide-react";
import GoogleSignInButton from "./auth/GoogleSignInButton";
import { useT } from "../context/LocaleContext";
import DescallBrand from "./brand/DescallBrand";
import LegalContentModal from "./legal/LegalContentModal";

export default function AuthView({ onLogin, onRegister, onGoogleLogin, onVerify2fa, loading, error }) {
  const t = useT();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "terms" | "privacy" | null

  // Accounts with 2FA enabled don't get logged in directly — the server
  // emails a one-time code and expects a follow-up verify call. This used to
  // go nowhere: onLogin would resolve, no token would ever be set, and the
  // login screen just sat there looking like nothing had happened.
  const [twoFa, setTwoFa] = useState(null); // { pendingToken, emailHint } | null
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");

  const needsTerms = mode === "register" && !termsAccepted;

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    if (mode === "login") {
      const result = await onLogin({ username: username.trim(), password });
      if (result?.requires2fa) {
        setTwoFa({ pendingToken: result.pendingToken, emailHint: result.emailHint });
        setCode("");
        setTwoFaError("");
      }
      return;
    }
    if (!termsAccepted) return;
    const trimmedEmail = email.trim();
    await onRegister({
      username: username.trim(),
      password,
      termsAccepted: true,
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
    });
  };

  const submitCode = async (event) => {
    event.preventDefault();
    if (!code.trim() || verifying) return;
    setVerifying(true);
    setTwoFaError("");
    try {
      await onVerify2fa(twoFa.pendingToken, code.trim());
    } catch (err) {
      setTwoFaError(err?.message || t("Incorrect code."));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-bg" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-pattern" />
      </div>

      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-logo-container">
          <DescallBrand compact className="auth-brand-mark" />
          <h1 className="auth-title">{t("Descall")}</h1>
          <p className="auth-subtitle">
            {twoFa
              ? t("Enter the code we sent to {email}", { email: twoFa.emailHint || t("your email") })
              : t("Connect with friends through voice, video, and messaging")}
          </p>
        </div>

        {twoFa ? (
          <form onSubmit={submitCode} className="auth-form">
            <div className="input-wrapper">
              <ShieldCheck className="input-icon" size={20} />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("Verification code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={8}
                autoFocus
                required
              />
            </div>

            {(twoFaError || error) && <p className="error-message">{twoFaError || error}</p>}

            <button type="submit" className="auth-submit" disabled={verifying || !code.trim()}>
              {verifying ? <span>{t("Please wait...")}</span> : <span>{t("Verify")}</span>}
            </button>

            <button
              type="button"
              className="auth-tab"
              style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
              onClick={() => {
                setTwoFa(null);
                setCode("");
                setTwoFaError("");
              }}
            >
              <ArrowLeft size={16} />
              <span>{t("Back to login")}</span>
            </button>
          </form>
        ) : (
        <>
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            <MessageCircle size={18} />
            <span>{t("Login")}</span>
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
          >
            <UserPlus size={18} />
            <span>{t("Register")}</span>
          </button>
        </div>

        <GoogleSignInButton
          disabled={loading}
          onCredential={async (credential) => {
            await onGoogleLogin?.(credential);
          }}
        />

        <div className="auth-divider" aria-hidden="true">
          <span>{t("or")}</span>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="input-wrapper">
            <User className="input-icon" size={20} />
            <input
              type="text"
              placeholder={t("Username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              autoComplete="username"
              required
            />
          </div>

          <div className="input-wrapper">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              placeholder={t("Password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </div>

          {mode === "register" && (
            <div className="input-wrapper">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                placeholder={t("Email (optional)")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                autoComplete="email"
              />
            </div>
          )}
          {mode === "register" && (
            <p className="auth-field-hint">
              {t("Adding an email unlocks account recovery, sign-in codes, and two-factor authentication. You can also add it later in Settings.")}
            </p>
          )}

          {mode === "register" && (
            <div className="legal-consent">
              <input
                id="auth-terms-checkbox"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <label htmlFor="auth-terms-checkbox">
                {t("I have read and agree to the")}{" "}
                <button type="button" className="legal-consent-link" onClick={() => setLegalModal("terms")}>
                  {t("Terms of Service")}
                </button>{" "}
                {t("and")}{" "}
                <button type="button" className="legal-consent-link" onClick={() => setLegalModal("privacy")}>
                  {t("Privacy Policy")}
                </button>
                .
              </label>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || !username.trim() || !password || needsTerms}
          >
            {loading ? (
              <span>{t("Please wait...")}</span>
            ) : mode === "login" ? (
              <span>{t("Login")}</span>
            ) : (
              <span>{t("Create Account")}</span>
            )}
          </button>
        </form>

        <p className="auth-footer">
          {t("By continuing, you agree to our Terms of Service")}
        </p>
        </>
        )}
      </motion.section>

      <LegalContentModal open={legalModal === "terms"} type="terms" onClose={() => setLegalModal(null)} />
      <LegalContentModal open={legalModal === "privacy"} type="privacy" onClose={() => setLegalModal(null)} />
    </main>
  );
}
