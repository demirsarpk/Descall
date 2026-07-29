import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, UserPlus, Lock, Mail } from "lucide-react";
import GoogleSignInButton from "./auth/GoogleSignInButton";

// Simple Descall Logo
function DescallLogo({ size = 60 }) {
  return (
    <div className="descall-logo">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* Chat bubble */}
        <path
          d="M30 45 C30 35, 35 30, 50 30 C65 30, 70 35, 70 45 C70 55, 65 60, 50 60 L45 68 L40 60 C35 58, 30 55, 30 45"
          fill="url(#logoGrad)"
        />
        {/* Sound waves */}
        <path
          d="M75 40 Q82 50, 75 60"
          stroke="url(#logoGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M82 35 Q92 50, 82 65"
          stroke="url(#logoGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export default function AuthView({ onLogin, onRegister, onGoogleLogin, loading, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      return;
    }
    if (mode === "login") {
      await onLogin({ username: username.trim(), password });
      return;
    }
    await onRegister({ username: username.trim(), password });
  };

  return (
    <main className="auth-shell">
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="auth-logo-container">
          <DescallLogo size={80} />
          <h1 className="auth-title">Descall</h1>
          <p className="auth-subtitle">Connect with friends through voice, video, and messaging</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            <MessageCircle size={18} />
            <span>Login</span>
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
          >
            <UserPlus size={18} />
            <span>Register</span>
          </button>
        </div>

        <GoogleSignInButton
          disabled={loading}
          onCredential={async (credential) => {
            await onGoogleLogin?.(credential);
          }}
        />

        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="auth-form">
          <div className="input-wrapper">
            <Mail className="input-icon" size={20} />
            <input
              type="text"
              placeholder="Username"
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
              placeholder="Password"
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
              <span>Please wait...</span>
            ) : mode === "login" ? (
              <span>Login</span>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="auth-footer">
          By continuing, you agree to our Terms of Service
        </p>
      </motion.section>
    </main>
  );
}
