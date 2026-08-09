import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, UserPlus, Lock, Mail } from "lucide-react";
import GoogleSignInButton from "./auth/GoogleSignInButton";
import { useT } from "../context/LocaleContext";
import DescallBrand from "./brand/DescallBrand";

export default function AuthView({ onLogin, onRegister, onGoogleLogin, loading, error }) {
  const t = useT();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    if (mode === "login") {
      await onLogin({ username: username.trim(), password });
      return;
    }
    await onRegister({ username: username.trim(), password });
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
          <DescallBrand />
          <h1 className="auth-title">{t("Descall")}</h1>
          <p className="auth-subtitle">{t("Connect with friends through voice, video, and messaging")}</p>
        </div>

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
            <Mail className="input-icon" size={20} />
            <input
              type="text"
              placeholder={t("Username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
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
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || !username.trim() || !password}
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
      </motion.section>
    </main>
  );
}
