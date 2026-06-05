import { useState, useEffect, useRef } from 'react';
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
import TitleBar from '../TitleBar';
import './DownloadPage.css';

const GITHUB_REPO = 'demirrsarppkurtlarr/Descall';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Fallback download link for private repos (update this manually after each release)
const FALLBACK_DOWNLOAD_URL = "https://github.com/demirrsarppkurtlarr/descall/releases/download/v2.2.11/Descall-Setup-2.2.11.exe";

const features = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: Users, title: "Group Chats", desc: "Create groups with unlimited members" },
];

const platforms = [
  { 
    id: 'windows', 
    name: 'Windows', 
    icon: Monitor, 
    file: 'Descall-Setup.exe',
    size: '~150 MB',
    color: '#0078D4'
  },
  { 
    id: 'mac', 
    name: 'macOS', 
    icon: Smartphone, 
    file: 'Descall.dmg',
    size: '~165 MB',
    color: '#000000'
  },
  { 
    id: 'linux', 
    name: 'Linux', 
    icon: Terminal, 
    file: 'Descall.AppImage',
    size: '~170 MB',
    color: '#25D366'
  },
];

const stats = [
  { value: "10K+", label: "Downloads" },
  { value: "4.9", label: "Rating" },
  { value: "50+", label: "Countries" },
];

export default function DownloadPage({ onLogin, onRegister, authLoading, authError }) {
  const [selectedPlatform, setSelectedPlatform] = useState('windows');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [releaseError, setReleaseError] = useState(null);
  const [downloadLinks, setDownloadLinks] = useState({ windows: null, mac: null, linux: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const downloadIntervalRef = useRef(null);

  useEffect(() => {
    detectPlatform();
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
    try {
      const response = await fetch(GITHUB_API);
      if (response.status === 404) {
        // Try fallback URL for private repos
        if (FALLBACK_DOWNLOAD_URL) {
          setDownloadLinks({ windows: FALLBACK_DOWNLOAD_URL, mac: null, linux: null });
          setLatestRelease({ tag_name: 'V2.0.0-REMAKE' });
        } else {
          setReleaseError('Release not found. Please check the GitHub repository.');
        }
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch release');
      const data = await response.json();
      
      setLatestRelease(data);
      
      // Parse assets for download links
      const links = { windows: null, mac: null, linux: null };
      
      if (data.assets && Array.isArray(data.assets)) {
        data.assets.forEach(asset => {
          const name = asset.name.toLowerCase();
          if (name.includes('setup') && name.endsWith('.exe')) {
            links.windows = asset.browser_download_url;
          } else if (name.includes('dmg') || name.includes('mac')) {
            links.mac = asset.browser_download_url;
          } else if (name.includes('appimage') || name.includes('deb') || name.includes('linux')) {
            links.linux = asset.browser_download_url;
          }
        });
      }
      
      setDownloadLinks(links);
    } catch (error) {
      setReleaseError('Unable to fetch release. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) setSelectedPlatform('windows');
    else if (userAgent.includes('mac')) setSelectedPlatform('mac');
    else if (userAgent.includes('linux')) setSelectedPlatform('linux');
  };

  const handleDownload = async () => {
    const downloadUrl = downloadLinks[selectedPlatform];
    
    if (!downloadUrl) {
      setReleaseError('Setup file not available yet. Please check back later.');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    // Simulate download progress
    downloadIntervalRef.current = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(downloadIntervalRef.current);
          setIsInstalled(true);
          setDownloading(false);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Open download link
    window.open(downloadUrl, '_blank');
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
    };
  }, []);

  const currentPlatform = platforms.find(p => p.id === selectedPlatform);

  return (
    <>
      <TitleBar />
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
            <span>{latestRelease?.tag_name || 'Loading...'} Now Available</span>
          </motion.div>

          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Descall Desktop
            <span className="gradient-text"> Experience</span>
          </motion.h1>

          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            The ultimate chat application for your desktop. 
            Fast, secure, and beautifully designed.
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
            <span>Sign In</span>
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
                  <h3>Descall for {currentPlatform.name}</h3>
                  <p>{currentPlatform.file} • {currentPlatform.size}</p>
                </div>
              </div>

              {/* Requirements */}
              <div className="requirements">
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>
                    {selectedPlatform === 'windows' && 'Windows 10/11 or newer'}
                    {selectedPlatform === 'mac' && 'macOS 10.15 or newer'}
                    {selectedPlatform === 'linux' && 'Ubuntu 18.04+ / Debian 10+'}
                  </span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>64-bit processor</span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>500 MB free space</span>
                </div>
              </div>

              {/* Download Button */}
              {releaseError && (
                <div className="release-error">{releaseError}</div>
              )}
              <motion.button
                className={`download-btn ${downloading ? 'downloading' : ''} ${isInstalled ? 'installed' : ''}`}
                onClick={handleDownload}
                disabled={downloading || isInstalled}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {downloading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    <span>Downloading... {Math.round(downloadProgress)}%</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </>
                ) : isInstalled ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Download Started</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Download for {currentPlatform.name}</span>
                    <ChevronRight size={18} className="arrow" />
                  </>
                )}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Additional Links */}
          <div className="additional-links">
            {/* Add manual download links here if needed */}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
              Download links will be available soon
            </span>
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
          <h2>Why Choose Descall?</h2>
          <p>Experience the next generation of communication</p>
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
            <h4>End-to-End Security</h4>
            <p>Your conversations are encrypted and secure</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Zap size={32} />
            <h4>Lightning Fast</h4>
            <p>Built for speed with native performance</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Globe size={32} />
            <h4>Global Network</h4>
            <p>Connect with anyone, anywhere in the world</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="download-footer">
        <p>© 2026 Descall. All rights reserved.</p>
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
            
            <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{isRegistering ? 'Join Descall today' : 'Sign in to your account'}</p>
            
            {authError && <div className="auth-error">{authError}</div>}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                if (isRegistering) {
                  await onRegister?.({ username, password });
                } else {
                  await onLogin?.({ username, password });
                }
                // Close modal on success
                setShowLogin(false);
                setUsername('');
                setPassword('');
              } catch (err) {
                // Keep modal open to show error
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting || authLoading}
              >
                {(isSubmitting || authLoading) ? 'Loading...' : (isRegistering ? 'Create Account' : 'Sign In')}
              </button>
            </form>
            
            <div className="auth-switch">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              <button 
                type="button"
                className="switch-btn"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </>
  );
}
