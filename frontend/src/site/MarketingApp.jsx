import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Routes, Route, useLocation } from "react-router-dom";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import LegalContentModal from "../components/legal/LegalContentModal";
import DownloadPage from "../components/download/DownloadPage";
import "../components/download/DownloadPage.css";
import { useT } from "../context/LocaleContext";
import MarketingLayout from "./MarketingLayout";
import SeoHead from "./SeoHead";
import { initAnalytics, trackPageView } from "./analytics";
import HomePage from "./pages/HomePage";
import FeaturesPage from "./pages/FeaturesPage";
import FaqPage from "./pages/FaqPage";
import SecurityPage from "./pages/SecurityPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CompareDiscordPage from "./pages/CompareDiscordPage";
import NotFoundPage from "./pages/NotFoundPage";

function enableMarketingScroll() {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById("root");
  const prev = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlHeight: html.style.height,
    bodyHeight: body.style.height,
    rootOverflow: root?.style.overflow,
    rootHeight: root?.style.height,
  };
  html.style.overflow = "auto";
  html.style.height = "auto";
  body.style.overflow = "auto";
  body.style.height = "auto";
  if (root) {
    root.style.overflow = "visible";
    root.style.height = "auto";
  }
  return () => {
    html.style.overflow = prev.htmlOverflow;
    html.style.height = prev.htmlHeight;
    body.style.overflow = prev.bodyOverflow;
    body.style.height = prev.bodyHeight;
    if (root) {
      root.style.overflow = prev.rootOverflow;
      root.style.height = prev.rootHeight;
    }
  };
}

function AuthModal({
  open,
  onClose,
  onLogin,
  onRegister,
  onGoogleLogin,
  authLoading,
  authError,
}) {
  const t = useT();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState(null);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
      setIsRegistering(false);
      setIsSubmitting(false);
      setTermsAccepted(false);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting || authLoading) return;
    if (isRegistering && !termsAccepted) return;
    setIsSubmitting(true);
    try {
      if (isRegistering) await onRegister?.({ username, password, termsAccepted: true });
      else await onLogin?.({ username, password });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="login-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ zIndex: 10000 }}
        >
          <motion.div
            className="login-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
            <h2>{isRegistering ? t("Create Account") : t("Welcome Back")}</h2>
            <p>{isRegistering ? t("Join Descall today") : t("Sign in to your account")}</p>
            {authError && <div className="auth-error">{authError}</div>}
            <GoogleSignInButton
              disabled={isSubmitting || authLoading}
              onCredential={async (credential) => {
                setIsSubmitting(true);
                try {
                  await onGoogleLogin?.(credential);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            />
            <form onSubmit={submit}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("Username")}
                autoComplete="username"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("Password")}
                autoComplete={isRegistering ? "new-password" : "current-password"}
                required
              />
              {isRegistering && (
                <div className="legal-consent">
                  <input
                    id="mkt-auth-terms-checkbox"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <label htmlFor="mkt-auth-terms-checkbox">
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
              <button
                type="submit"
                disabled={isSubmitting || authLoading || (isRegistering && !termsAccepted)}
              >
                {isRegistering ? t("Create Account") : t("Sign In")}
              </button>
            </form>
            <button
              type="button"
              className="auth-switch"
              onClick={() => setIsRegistering((v) => !v)}
            >
              {isRegistering ? t("Already have an account? Sign in") : t("Need an account? Register")}
            </button>
          </motion.div>
          <LegalContentModal open={legalModal === "terms"} type="terms" onClose={() => setLegalModal(null)} />
          <LegalContentModal open={legalModal === "privacy"} type="privacy" onClose={() => setLegalModal(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function withLayout(Page, openAuth, pageProps = {}) {
  return (
    <MarketingLayout onSignIn={openAuth}>
      <Page onSignIn={openAuth} {...pageProps} />
    </MarketingLayout>
  );
}

/**
 * Logged-out public marketing shell (SEO routes).
 * Authenticated app stays in App.jsx and should force noindex.
 */
export default function MarketingApp({
  onLogin,
  onRegister,
  onGoogleLogin,
  authLoading,
  authError,
}) {
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname === "/download") return undefined;
    return enableMarketingScroll();
  }, [location.pathname]);

  const openAuth = () => setAuthOpen(true);
  const authProps = { onLogin, onRegister, onGoogleLogin, authLoading, authError };

  return (
    <>
      <SeoHead />
      <Routes>
        <Route path="/download" element={<DownloadPage {...authProps} />} />
        <Route path="/" element={withLayout(HomePage, openAuth)} />
        <Route path="/features" element={withLayout(FeaturesPage, openAuth)} />
        <Route path="/faq" element={withLayout(FaqPage, openAuth)} />
        <Route path="/security" element={withLayout(SecurityPage, openAuth)} />
        <Route path="/privacy" element={withLayout(PrivacyPage, openAuth)} />
        <Route path="/terms" element={withLayout(TermsPage, openAuth)} />
        <Route path="/about" element={withLayout(AboutPage, openAuth)} />
        <Route path="/contact" element={withLayout(ContactPage, openAuth)} />
        <Route path="/compare/discord" element={withLayout(CompareDiscordPage, openAuth)} />
        <Route path="*" element={withLayout(NotFoundPage, openAuth)} />
      </Routes>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} {...authProps} />
    </>
  );
}
