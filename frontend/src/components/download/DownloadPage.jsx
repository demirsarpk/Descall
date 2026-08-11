import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Monitor,
  Smartphone,
  Terminal,
  CheckCircle2, 
  Loader2,
  Sparkles,
  Zap,
  Shield,
  Globe,
  MessageCircle,
  Mic,
  Video,
  Users,
  ChevronRight,
  Github,
  Star,
  LogIn,
  X
} from 'lucide-react';
import GoogleSignInButton from '../auth/GoogleSignInButton';
import LegalContentModal from '../legal/LegalContentModal';
import { fetchLatestDesktopRelease } from '../../lib/githubRelease';
import { formatReleaseLabel } from '../../lib/releaseVersion';
import { DESKTOP_RELEASE_FALLBACK } from '../../lib/desktopRelease';
import { useT } from '../../context/LocaleContext';
import './DownloadPage.css';

const GITHUB_REPO = 'demirsarpk/Descall';
const FALLBACK_WINDOWS_URL = DESKTOP_RELEASE_FALLBACK.windowsDownloadUrl;
// The Android asset filename is version-suffixed per release
// (Descall-APK-vX.Y.Z.apk), so there is no stable "latest" direct-download
// URL — the real link always comes from the live GitHub release asset list.
const ANDROID_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

const FEATURE_DEFS = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: Users, title: "Group Chats", desc: "Create groups with unlimited members" },
];

const STAT_DEFS = [
  { value: "10K+", label: "Downloads" },
  { value: "4.9", label: "Rating" },
  { value: "50+", label: "Countries" },
];

const platforms = [
  { 
    id: 'windows', 
    name: 'Windows', 
    icon: Monitor, 
    file: 'Descall-Setup.exe',
    size: '~138 MB',
    color: '#0078D4'
  },
  {
    id: 'android',
    name: 'Android APK',
    icon: Smartphone,
    file: 'Descall-APK.apk',
    size: 'Latest release',
    color: '#5B74FF'
  },
];

export default function DownloadPage({ onLogin, onRegister, onGoogleLogin, authLoading, authError, onOpenRegister }) {
  const t = useT();
  const features = FEATURE_DEFS.map((f) => ({ ...f, title: t(f.title), desc: t(f.desc) }));
  const stats = STAT_DEFS.map((s) => ({ ...s, label: t(s.label) }));
  const [selectedPlatform, setSelectedPlatform] = useState('windows');
  const [isInstalled, setIsInstalled] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [releaseError, setReleaseError] = useState(null);
  const [downloadLinks, setDownloadLinks] = useState({ windows: null, android: null });
  const [windowsDownloadUrl, setWindowsDownloadUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyRelease = (data, { softError = null } = {}) => {
    setLatestRelease({
      tag_name: data.tagName,
      name: data.name,
      published_at: data.publishedAt,
      html_url: data.htmlUrl,
    });
    // Never offer Portable builds — only the NSIS Setup installer
    const winUrl =
      data.windowsDownloadUrl && !/portable/i.test(data.windowsDownloadUrl)
        ? data.windowsDownloadUrl
        : FALLBACK_WINDOWS_URL;
    setWindowsDownloadUrl(winUrl);
    setDownloadLinks({
      windows: winUrl,
      android: data.androidDownloadUrl || null,
    });
    setReleaseError(softError);
  };

  const fetchLatestRelease = async () => {
    setLoading(true);
    setReleaseError(null);
    try {
      const data = await fetchLatestDesktopRelease();
      applyRelease(data);
    } catch (error) {
      // GitHub API often 403s (rate limit) on shared hosts — still offer Setup fallback
      applyRelease(DESKTOP_RELEASE_FALLBACK, {
        softError: null,
      });
      console.warn('Release API failed, using fallback installer:', error?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectPlatform();
    fetchLatestRelease();
  }, []);

  // Re-check latest release whenever the landing page is shown again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLatestRelease();
    };
    const onPageShow = () => fetchLatestRelease();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;
    const prevRootOverflow = root?.style.overflow;
    const prevRootHeight = root?.style.height;

    html.style.overflow = 'auto';
    html.style.height = 'auto';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    if (root) {
      root.style.overflow = 'visible';
      root.style.height = 'auto';
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
      }
    };
  }, []);

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) setSelectedPlatform('android');
    else if (userAgent.includes('win')) setSelectedPlatform('windows');
  };

  const handleDownload = () => {
    const downloadUrl = selectedPlatform === 'android'
      ? (downloadLinks.android || ANDROID_RELEASES_PAGE_URL)
      : (windowsDownloadUrl || downloadLinks.windows || FALLBACK_WINDOWS_URL);
    window.open(downloadUrl, '_blank');
    setIsInstalled(true);
  };

  const currentPlatform = platforms.find(p => p.id === selectedPlatform);
  const releaseLabel = formatReleaseLabel(latestRelease?.tag_name);

  return (
    <>
      <div className="download-page">
        {/* Animated Background */}
      <div className="download-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-pattern" />
      </div>

      {/* Hero Section */}
      <section className="download-hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <motion.div 
            className="version-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Sparkles size={14} />
            <span>{loading ? t("Checking for updates…") : (releaseLabel ? t("{label} available", { label: releaseLabel }) : t("Latest release"))}</span>
          </motion.div>

          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t("Descall")} {t("Desktop")}
            <span className="gradient-text"> {t("Experience")}</span>
          </motion.h1>

          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {t("The ultimate chat application for your desktop. Fast, secure, and beautifully designed.")}
          </motion.p>

          {/* Login Button */}
          <motion.button
            className="login-btn"
            onClick={() => {
              setShowLogin(true);
              setIsRegistering(false);
              setUsername('');
              setPassword('');
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <LogIn size={18} />
            <span>{t("Sign In")}</span>
          </motion.button>

          {/* Stats */}
          <motion.div 
            className="stats-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="stat-item"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Download Card */}
        <motion.div 
          className="download-card"
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          {/* Platform Selector */}
          <div className="platform-tabs">
            {platforms.map((platform) => (
              <motion.button
                key={platform.id}
                className={`platform-tab ${selectedPlatform === platform.id ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(platform.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <platform.icon size={20} />
                <span>{platform.name}</span>
              </motion.button>
            ))}
          </div>

          {/* Selected Platform Info */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPlatform}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="platform-info"
            >
              <div className="platform-header">
                <div 
                  className="platform-icon-large"
                  style={{ background: currentPlatform.color }}
                >
                  <currentPlatform.icon size={32} color="white" />
                </div>
                <div className="platform-details">
                  <h3>{t("Descall for {name}", { name: currentPlatform.name })}</h3>
                  <p>
                    {selectedPlatform === 'windows' || selectedPlatform === 'android'
                      ? `${currentPlatform.file}${releaseLabel ? ` • ${releaseLabel}` : ''} • ${currentPlatform.size}`
                      : `${currentPlatform.file} • ${t("Web app")}`}
                  </p>
                </div>
              </div>

              {/* Requirements */}
              <div className="requirements">
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>
                    {selectedPlatform === 'windows' && t("Windows 10/11 (64-bit) — desktop installer")}
                    {selectedPlatform === 'android' && t("Android 10+ — signed APK")}
                    {selectedPlatform === 'mac' && t("macOS — use Descall in your browser (no desktop build)")}
                    {selectedPlatform === 'linux' && t("Linux — use Descall in your browser (no desktop build)")}
                  </span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>{t("64-bit processor")}</span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>{t("500 MB free space")}</span>
                </div>
              </div>

              {/* Download Button */}
              {releaseError && (
                <div className="release-error">{releaseError}</div>
              )}
              <motion.button
                className={`download-btn ${isInstalled ? 'installed' : ''}`}
                onClick={handleDownload}
                disabled={loading && selectedPlatform === 'windows' && !(windowsDownloadUrl || downloadLinks.windows || FALLBACK_WINDOWS_URL)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    <span>{t("Checking for updates…")}</span>
                  </>
                ) : isInstalled ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>{t("Download started")}</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>
                      {selectedPlatform === 'windows' || selectedPlatform === 'android'
                        ? t("Download for {name}", { name: currentPlatform.name })
                        : t("Sign in to use web app")}
                    </span>
                    <ChevronRight size={18} className="arrow" />
                  </>
                )}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Additional Links */}
          <div className="additional-links">
            <a
              href={`https://github.com/${GITHUB_REPO}/releases/latest`}
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <Github size={16} />
              <span>{t("All releases on GitHub")}</span>
            </a>
            <button
              type="button"
              className="github-link"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => fetchLatestRelease()}
            >
              <Zap size={16} />
              <span>{t("Check for updates")}</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="section-header"
        >
          <h2>{t("Why Choose Descall?")}</h2>
          <p>{t("Experience the next generation of communication")}</p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="feature-icon">
                <feature.icon size={28} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-grid">
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Shield size={32} />
            <h4>{t("End-to-End Security")}</h4>
            <p>{t("Your conversations are encrypted and secure")}</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Zap size={32} />
            <h4>{t("Lightning Fast")}</h4>
            <p>{t("Built for speed with native performance")}</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Globe size={32} />
            <h4>{t("Global Network")}</h4>
            <p>{t("Connect with anyone, anywhere in the world")}</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="download-footer">
        <p>{t("© 2026 Descall. All rights reserved.")}</p>
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
      {showLogin && (
        <motion.div 
          className="login-modal-overlay" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowLogin(false)}
        >
          <motion.div 
            className="login-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowLogin(false)}>
              <X size={20} />
            </button>
            
            <h2>{isRegistering ? t("Create Account") : t("Welcome Back")}</h2>
            <p>{isRegistering ? t("Join Descall today") : t("Sign in to your account")}</p>
            
            {authError && <div className="auth-error">{authError}</div>}

            <GoogleSignInButton
              disabled={isSubmitting || authLoading || (isRegistering && !termsAccepted)}
              onCredential={async (credential) => {
                if (isRegistering && !termsAccepted) return;
                setIsSubmitting(true);
                try {
                  await onGoogleLogin?.(credential, { termsAccepted: isRegistering });
                  setShowLogin(false);
                  setUsername('');
                  setPassword('');
                  setEmail('');
                } catch {
                  /* App sets authError */
                } finally {
                  setIsSubmitting(false);
                }
              }}
            />

            <div className="auth-divider" aria-hidden="true">
              <span>{t("or")}</span>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (isRegistering && !termsAccepted) return;
              setIsSubmitting(true);
              try {
                if (isRegistering) {
                  const trimmedEmail = email.trim();
                  await onRegister?.({
                    username,
                    password,
                    termsAccepted: true,
                    ...(trimmedEmail ? { email: trimmedEmail } : {}),
                  });
                } else {
                  await onLogin?.({ username, password });
                }
                // Close modal on success
                setShowLogin(false);
                setUsername('');
                setPassword('');
                setEmail('');
                setTermsAccepted(false);
              } catch (err) {
                // Keep modal open to show error
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div className="form-group">
                <label>{t("Username")}</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("Enter username")}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>{t("Password")}</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("Enter password")}
                  required
                />
              </div>

              {isRegistering && (
                <div className="form-group">
                  <label>{t("Email (optional)")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("Email (optional)")}
                    autoComplete="email"
                    maxLength={254}
                  />
                </div>
              )}
              
              {isRegistering && (
                <div className="legal-consent">
                  <input
                    id="dl-auth-terms-checkbox"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <label htmlFor="dl-auth-terms-checkbox">
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
                className="submit-btn"
                disabled={isSubmitting || authLoading || (isRegistering && !termsAccepted)}
              >
                {(isSubmitting || authLoading) ? t("Loading...") : (isRegistering ? t("Create Account") : t("Sign In"))}
              </button>
            </form>
            
            <div className="auth-switch">
              {isRegistering ? t("Already have an account?") : t("Don't have an account?")}
              <button 
                type="button"
                className="switch-btn"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? t("Sign In") : t("Create Account")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      <LegalContentModal open={legalModal === "terms"} type="terms" onClose={() => setLegalModal(null)} />
      <LegalContentModal open={legalModal === "privacy"} type="privacy" onClose={() => setLegalModal(null)} />
      </div>
    </>
  );
}
