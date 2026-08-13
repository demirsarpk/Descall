import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { X, ArrowLeft } from "lucide-react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import ForgotPasswordFlow from "../components/auth/ForgotPasswordFlow";
import LegalContentModal from "../components/legal/LegalContentModal";
import { useT } from "../context/LocaleContext";
import {
  persistInviteRef,
  peekInviteRef,
  readInviteRefFromLocation,
} from "../lib/referral";
import { Funnel, trackPageView } from "./analytics";
import MarketingLayout from "./MarketingLayout";
import SeoHead from "./SeoHead";

const DownloadPage = lazy(() => import("../components/download/DownloadPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const CompareDiscordPage = lazy(() => import("./pages/CompareDiscordPage"));
const DiscordAlternativePage = lazy(() => import("./pages/DiscordAlternativePage"));
const AlternativesPage = lazy(() => import("./pages/AlternativesPage"));
const DiscordAlternativeGamersPage = lazy(() => import("./pages/DiscordAlternativeGamersPage"));
const DiscordAlternativeTurkeyPage = lazy(() => import("./pages/DiscordAlternativeTurkeyPage"));
const DiscordAlternativeNichePage = lazy(() => import("./pages/DiscordAlternativeNichePage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

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
  onVerify2fa,
  authLoading,
  authError,
  initialMode = "login",
  authSource = "modal",
  inviteRef = "",
}) {
  const t = useT();
  const [isRegistering, setIsRegistering] = useState(initialMode === "register");
  const [forgotMode, setForgotMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState(null);

  const [twoFa, setTwoFa] = useState(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
      setEmail("");
      setIsSubmitting(false);
      setTermsAccepted(false);
      setTwoFa(null);
      setCode("");
      setTwoFaError("");
      setForgotMode(false);
      return;
    }
    setIsRegistering(initialMode === "register");
    setForgotMode(false);
    Funnel.registerStart({
      mode: initialMode === "register" ? "register" : "login",
      source: authSource,
      has_invite: Boolean(inviteRef),
      invited_by: inviteRef || undefined,
    });
  }, [open, initialMode, authSource, inviteRef]);

  const withInvite = (payload = {}) => {
    const ref = inviteRef || peekInviteRef();
    if (ref) return { ...payload, invitedBy: ref };
    return payload;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting || authLoading) return;
    if (isRegistering && !termsAccepted) return;
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        const trimmedEmail = email.trim();
        await onRegister?.(
          withInvite({
            username,
            password,
            termsAccepted: true,
            ...(trimmedEmail ? { email: trimmedEmail } : {}),
          })
        );
      } else {
        const result = await onLogin?.({ username, password });
        if (result?.requires2fa) {
          setTwoFa({ pendingToken: result.pendingToken, emailHint: result.emailHint });
          setCode("");
          setTwoFaError("");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    if (!code.trim() || verifying) return;
    setVerifying(true);
    setTwoFaError("");
    try {
      await onVerify2fa?.(twoFa.pendingToken, code.trim());
    } catch (err) {
      setTwoFaError(err?.message || t("Incorrect code."));
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  return (
        <div
          className="login-modal-overlay"
          onClick={onClose}
          style={{ zIndex: 10000 }}
          role="presentation"
        >
          <div
            className="login-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isRegistering ? t("Create account") : t("Sign in")}
          >
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
            {twoFa ? (
              <>
                <h2>{t("Two-Factor Verification")}</h2>
                <p>{t("Enter the code we sent to {email}", { email: twoFa.emailHint || t("your email") })}</p>
                {(twoFaError || authError) && <div className="auth-error">{twoFaError || authError}</div>}
                <form onSubmit={submitCode}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("Verification code")}
                    maxLength={8}
                    autoFocus
                    required
                  />
                  <button type="submit" disabled={verifying || !code.trim()}>
                    {verifying ? t("Please wait...") : t("Verify")}
                  </button>
                </form>
                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => {
                    setTwoFa(null);
                    setCode("");
                    setTwoFaError("");
                  }}
                >
                  <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  {t("Back to login")}
                </button>
              </>
            ) : forgotMode ? (
              <>
                <h2>{t("Forgot your password?")}</h2>
                <p>{t("Reset your password with a secure email code")}</p>
                <ForgotPasswordFlow
                  variant="modal"
                  onBack={() => setForgotMode(false)}
                />
              </>
            ) : (
              <>
                <h2>{isRegistering ? t("Create Account") : t("Welcome Back")}</h2>
                <p>
                  {isRegistering
                    ? inviteRef
                      ? t("Join {name} on Descall — free chat, voice, and calls.", { name: inviteRef })
                      : t("Join Descall today")
                    : t("Sign in to your account")}
                </p>
                {inviteRef && isRegistering && (
                  <div className="mkt-invite-banner" role="status">
                    {t("Invited by @{username}", { username: inviteRef })}
                  </div>
                )}
                {authError && <div className="auth-error">{authError}</div>}
                <GoogleSignInButton
                  disabled={isSubmitting || authLoading || (isRegistering && !termsAccepted)}
                  onCredential={async (credential) => {
                    if (isRegistering && !termsAccepted) return;
                    setIsSubmitting(true);
                    try {
                      await onGoogleLogin?.(credential, withInvite({ termsAccepted: isRegistering }));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                />
                {isRegistering && (
                  <p className="mkt-auth-field-hint mkt-auth-google-hint">
                    {t("Fastest path: continue with Google, then you’re in.")}
                  </p>
                )}
                <div className="mkt-auth-divider" aria-hidden>
                  <span>{t("or")}</span>
                </div>
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
                  {!isRegistering && (
                    <div className="mkt-forgot-row">
                      <button type="button" className="mkt-forgot-link" onClick={() => setForgotMode(true)}>
                        {t("Forgot your password?")}
                      </button>
                    </div>
                  )}
                  {isRegistering && (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("Email (optional)")}
                      autoComplete="email"
                      maxLength={254}
                    />
                  )}
                  {isRegistering && (
                    <p className="mkt-auth-field-hint">
                      {t(
                        "Adding an email unlocks account recovery, sign-in codes, and two-factor authentication. You can also add it later in Settings."
                      )}
                    </p>
                  )}
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
              </>
            )}
          </div>
          <LegalContentModal open={legalModal === "terms"} type="terms" onClose={() => setLegalModal(null)} />
          <LegalContentModal open={legalModal === "privacy"} type="privacy" onClose={() => setLegalModal(null)} />
        </div>
  );
}

function withLayout(Page, openAuth, pageProps = {}) {
  return (
    <MarketingLayout onSignIn={openAuth} onSignUp={(opts) => openAuth({ mode: "register", ...opts })}>
      <Suspense fallback={null}>
        <Page
          onSignIn={openAuth}
          onSignUp={(opts) => openAuth({ mode: "register", ...opts })}
          {...pageProps}
        />
      </Suspense>
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
  onVerify2fa,
  authLoading,
  authError,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authSource, setAuthSource] = useState("modal");
  const [inviteRef, setInviteRef] = useState(() => peekInviteRef());

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname === "/download") return undefined;
    return enableMarketingScroll();
  }, [location.pathname]);

  // Capture ?ref= / invite attribution + deep-link auth modes
  useEffect(() => {
    const fromUrl = readInviteRefFromLocation(location.search);
    if (fromUrl) {
      persistInviteRef(fromUrl);
      setInviteRef(fromUrl);
      Funnel.inviteLanding({ invited_by: fromUrl, path: location.pathname });
    } else {
      const peeked = peekInviteRef();
      if (peeked) setInviteRef(peeked);
    }

    const params = new URLSearchParams(location.search);
    const authParam = (params.get("auth") || "").toLowerCase();
    const path = location.pathname;

    if (path === "/register" || authParam === "register" || authParam === "signup" || fromUrl) {
      setAuthMode("register");
      setAuthSource(fromUrl ? "invite_link" : path === "/register" ? "register_route" : "query");
      setAuthOpen(true);
    } else if (path === "/login" || authParam === "login" || authParam === "signin") {
      setAuthMode("login");
      setAuthSource(path === "/login" ? "login_route" : "query");
      setAuthOpen(true);
    }
  }, [location.pathname, location.search]);

  const openAuth = useCallback((opts = {}) => {
    const mode = opts.mode === "register" || opts.mode === "signup" ? "register" : "login";
    setAuthMode(mode);
    setAuthSource(opts.source || "cta");
    setAuthOpen(true);
    Funnel.ctaClick({
      page: location.pathname,
      placement: opts.source || "cta",
      label: mode === "register" ? "start_free" : "sign_in",
      intent: mode,
    });
  }, [location.pathname]);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    if (location.pathname === "/register" || location.pathname === "/login") {
      navigate("/", { replace: true });
    } else if (location.search.includes("auth=")) {
      const params = new URLSearchParams(location.search);
      params.delete("auth");
      const next = params.toString();
      navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const authProps = {
    onLogin,
    onRegister,
    onGoogleLogin,
    onVerify2fa,
    authLoading,
    authError,
  };

  return (
    <>
      <SeoHead />
      <Routes>
        <Route path="/download" element={<DownloadPage {...authProps} onOpenRegister={() => openAuth({ mode: "register", source: "download" })} />} />
        <Route path="/" element={withLayout(HomePage, openAuth)} />
        <Route path="/register" element={withLayout(HomePage, openAuth)} />
        <Route path="/login" element={withLayout(HomePage, openAuth)} />
        <Route path="/features" element={withLayout(FeaturesPage, openAuth)} />
        <Route path="/faq" element={withLayout(FaqPage, openAuth)} />
        <Route path="/security" element={withLayout(SecurityPage, openAuth)} />
        <Route path="/privacy" element={withLayout(PrivacyPage, openAuth)} />
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/terms" element={withLayout(TermsPage, openAuth)} />
        <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
        <Route path="/about" element={withLayout(AboutPage, openAuth)} />
        <Route path="/contact" element={withLayout(ContactPage, openAuth)} />
        <Route path="/discord-alternative" element={withLayout(DiscordAlternativePage, openAuth)} />
        <Route path="/alternatives" element={withLayout(AlternativesPage, openAuth)} />
        <Route path="/compare/discord" element={withLayout(CompareDiscordPage, openAuth)} />
        <Route
          path="/best-discord-alternative-for-gamers"
          element={withLayout(DiscordAlternativeGamersPage, openAuth)}
        />
        <Route
          path="/discord-alternative-for-communities"
          element={withLayout(DiscordAlternativeNichePage, openAuth)}
        />
        <Route
          path="/discord-alternative-for-lfg"
          element={withLayout(DiscordAlternativeNichePage, openAuth)}
        />
        <Route
          path="/discord-alternative-for-voice-chat"
          element={withLayout(DiscordAlternativeNichePage, openAuth)}
        />
        <Route
          path="/discord-alternative-for-friends"
          element={withLayout(DiscordAlternativeNichePage, openAuth)}
        />
        <Route path="/apps-like-discord" element={withLayout(DiscordAlternativeNichePage, openAuth)} />
        <Route path="/discord-replacement" element={withLayout(DiscordAlternativeNichePage, openAuth)} />
        <Route
          path="/discord-alternative-turkey"
          element={withLayout(DiscordAlternativeTurkeyPage, openAuth)}
        />
        <Route path="/discord-alternatives" element={<Navigate to="/alternatives" replace />} />
        <Route path="/best-discord-alternative" element={<Navigate to="/discord-alternative" replace />} />
        <Route path="/blog" element={withLayout(BlogIndexPage, openAuth)} />
        <Route path="/blog/:slug" element={withLayout(BlogPostPage, openAuth)} />
        <Route path="*" element={withLayout(NotFoundPage, openAuth)} />
      </Routes>
      <AuthModal
        open={authOpen}
        onClose={closeAuth}
        initialMode={authMode}
        authSource={authSource}
        inviteRef={inviteRef}
        {...authProps}
      />
    </>
  );
}
