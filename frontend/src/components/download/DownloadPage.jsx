import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Monitor,
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
  LogIn,
  X
} from 'lucide-react';
import TitleBar from '../TitleBar';
import './DownloadPage.css';

/** Must match GitHub repo that publishes Descall-Setup-*.exe (release workflow). */
const GITHUB_REPO = 'demirrsarppkurtlarr/Descall';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

const features = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: Users, title: "Group Chats", desc: "Create groups with unlimited members" },
];

function pickWindowsExeUrl(release) {
  if (!release?.assets?.length) return null;
  const assets = release.assets;
  const setupExe = assets.find((a) => {
    const n = a.name.toLowerCase();
    return n.endsWith('.exe') && (n.includes('setup') || n.includes('descall'));
  });
  if (setupExe?.browser_download_url) return setupExe.browser_download_url;
  const anyExe = assets.find((a) => a.name.toLowerCase().endsWith('.exe'));
  return anyExe?.browser_download_url || null;
}

export default function DownloadPage({ onLogin, onRegister, authLoading, authError }) {
  const [latestRelease, setLatestRelease] = useState(null);
  const [windowsDownloadUrl, setWindowsDownloadUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [releaseError, setReleaseError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLatestRelease();
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

  const fetchLatestRelease = async () => {
    setLoading(true);
    setReleaseError(null);
    try {
      const response = await fetch(GITHUB_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Henüz yayınlanmış sürüm yok.' : 'GitHub API hatası');
      }
      const data = await response.json();
      setLatestRelease(data);
      const url = pickWindowsExeUrl(data);
      if (!url) {
        setReleaseError('Bu sürümde Windows kurulum dosyası (.exe) bulunamadı.');
      }
      setWindowsDownloadUrl(url);
    } catch (error) {
      setReleaseError(error.message || 'Sürüm bilgisi alınamadı. Daha sonra tekrar deneyin.');
      setWindowsDownloadUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!windowsDownloadUrl) {
      setReleaseError('İndirme bağlantısı hazır değil.');
      return;
    }
    window.location.href = windowsDownloadUrl;
  };

  const versionLabel = latestRelease?.tag_name || (loading ? '…' : '—');
  const publishedAt = latestRelease?.published_at
    ? new Date(latestRelease.published_at).toLocaleDateString('tr-TR')
    : null;

  return (
    <>
      <TitleBar />
      <div className="download-page">
      <div className="download-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-pattern" />
      </div>

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
            <span>{versionLabel} — Windows masaüstü</span>
          </motion.div>

          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Descall for Windows
          </motion.h1>

          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Electron masaüstü uygulaması yalnızca Windows için derlenir. Her GitHub sürümünde indirme bağlantısı otomatik güncellenir.
          </motion.p>

          <motion.button
            className="login-cta"
            onClick={() => setShowLogin(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <LogIn size={18} />
            <span>Sign In</span>
          </motion.button>
        </motion.div>

        <motion.div 
          className="download-card"
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          <div className="platform-info" style={{ paddingTop: 8 }}>
            <div className="platform-header">
              <div 
                className="platform-icon-large"
                style={{ background: '#0078D4' }}
              >
                <Monitor size={32} color="white" />
              </div>
              <div className="platform-details">
                <h3>Descall for Windows</h3>
                <p>
                  {loading ? 'Sürüm kontrol ediliyor…' : `Kurulum: ${latestRelease?.name || versionLabel}`}
                  {publishedAt ? ` • ${publishedAt}` : ''}
                </p>
              </div>
            </div>

            <div className="requirements">
              <div className="req-item">
                <CheckCircle2 size={16} />
                <span>Windows 10 / 11 (64-bit)</span>
              </div>
              <div className="req-item">
                <CheckCircle2 size={16} />
                <span>macOS ve Linux — yalnızca web uygulaması</span>
              </div>
              <div className="req-item">
                <CheckCircle2 size={16} />
                <span>~500 MB boş disk</span>
              </div>
            </div>

            {releaseError && (
              <div className="release-error">{releaseError}</div>
            )}

            <motion.button
              className={`download-btn ${!windowsDownloadUrl ? 'downloading' : ''}`}
              onClick={handleDownload}
              disabled={loading || !windowsDownloadUrl}
              whileHover={windowsDownloadUrl ? { scale: 1.02 } : {}}
              whileTap={windowsDownloadUrl ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="spin" />
                  <span>Sürüm yükleniyor…</span>
                </>
              ) : (
                <>
                  <Download size={20} />
                  <span>Windows için indir ({versionLabel})</span>
                  <ChevronRight size={18} className="arrow" />
                </>
              )}
            </motion.button>
          </div>

          <div className="additional-links">
            <a
              href={`https://github.com/${GITHUB_REPO}/releases/latest`}
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <Github size={16} />
              <span>GitHub Releases — tüm sürümler</span>
            </a>
            {!loading && (
              <button
                type="button"
                className="github-link"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => fetchLatestRelease()}
              >
                <Zap size={16} />
                <span>Bağlantıyı yenile</span>
              </button>
            )}
          </div>
        </motion.div>
      </section>

      <section className="features-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="section-header"
        >
          <h2>Why Choose Descall?</h2>
          <p>Experience the next generation of communication</p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="feature-icon">
                <feature.icon size={24} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <div className="trust-badges">
          <div className="trust-badge">
            <Shield size={20} />
            <span>Secure</span>
          </div>
          <div className="trust-badge">
            <Globe size={20} />
            <span>Global</span>
          </div>
        </div>
      </section>

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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setShowLogin(false)}>
                <X size={20} />
              </button>
              <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
              {authError && <div className="auth-error">{authError}</div>}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmitting(true);
                  try {
                    if (isRegistering) await onRegister?.(username, password);
                    else await onLogin?.(username, password);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" disabled={authLoading || isSubmitting}>
                  {authLoading || isSubmitting ? <Loader2 className="spin" size={18} /> : (isRegistering ? 'Register' : 'Login')}
                </button>
              </form>
              <button
                type="button"
                className="toggle-auth"
                onClick={() => setIsRegistering((v) => !v)}
              >
                {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}
