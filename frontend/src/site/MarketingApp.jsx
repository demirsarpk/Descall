import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  persistInviteRef,
  peekInviteRef,
  readInviteRefFromLocation,
} from "../lib/referral";
import { Funnel, trackPageView } from "./analytics";
import { signalMarketingEngage } from "./analyticsGate";
import MarketingLayout from "./MarketingLayout";
import SeoHead from "./SeoHead";

const MarketingAuthModal = lazy(() => import("./MarketingAuthModal"));

const DownloadPage = lazy(() => import("./pages/MarketingDownloadPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
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
    // All marketing routes need document scroll — /download previously skipped this
    // and stayed stuck under critical html/body overflow:hidden after hydrate.
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

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("descall:open_auth");
      if (!pending) return;
      sessionStorage.removeItem("descall:open_auth");
      const mode = pending === "register" || pending === "signup" ? "register" : "login";
      setAuthMode(mode);
      setAuthSource("seo_static");
      setAuthOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const openAuth = useCallback((opts = {}) => {
    const mode = opts.mode === "register" || opts.mode === "signup" ? "register" : "login";
    setAuthMode(mode);
    setAuthSource(opts.source || "cta");
    setAuthOpen(true);
    signalMarketingEngage({ source: opts.source || "cta", intent: mode });
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
        <Route
          path="/download"
          element={withLayout(DownloadPage, openAuth, {
            onOpenRegister: () => openAuth({ mode: "register", source: "download" }),
          })}
        />
        <Route path="/" element={withLayout(HomePage, openAuth)} />
        <Route path="/register" element={withLayout(HomePage, openAuth)} />
        <Route path="/login" element={withLayout(HomePage, openAuth)} />
        <Route path="/features" element={withLayout(FeaturesPage, openAuth)} />
        <Route path="/faq" element={withLayout(FaqPage, openAuth)} />
        <Route path="/security" element={withLayout(SecurityPage, openAuth)} />
        <Route path="/status" element={withLayout(StatusPage, openAuth)} />
        <Route path="/privacy" element={withLayout(PrivacyPage, openAuth)} />
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/terms" element={withLayout(TermsPage, openAuth)} />
        <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
        <Route path="/about" element={withLayout(AboutPage, openAuth)} />
        <Route path="/contact" element={withLayout(ContactPage, openAuth)} />
        <Route path="/discord-alternative" element={withLayout(DiscordAlternativePage, openAuth)} />
        {/* TR locale mirrors — same pages, /tr prefix + forced TR locale in layout */}
        <Route path="/tr" element={withLayout(HomePage, openAuth)} />
        <Route path="/tr/features" element={withLayout(FeaturesPage, openAuth)} />
        <Route
          path="/tr/download"
          element={withLayout(DownloadPage, openAuth, {
            onOpenRegister: () => openAuth({ mode: "register", source: "download_tr" }),
          })}
        />
        <Route path="/tr/faq" element={withLayout(FaqPage, openAuth)} />
        <Route path="/tr/discord-alternative" element={withLayout(DiscordAlternativePage, openAuth)} />
        <Route path="/tr/about" element={withLayout(AboutPage, openAuth)} />
        <Route path="/tr/contact" element={withLayout(ContactPage, openAuth)} />
        <Route path="/tr/security" element={withLayout(SecurityPage, openAuth)} />
        <Route path="/tr/compare/discord" element={withLayout(CompareDiscordPage, openAuth)} />
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
      {authOpen ? (
        <Suspense fallback={null}>
          <MarketingAuthModal
            open={authOpen}
            onClose={closeAuth}
            initialMode={authMode}
            authSource={authSource}
            inviteRef={inviteRef}
            {...authProps}
          />
        </Suspense>
      ) : null}
    </>
  );
}
