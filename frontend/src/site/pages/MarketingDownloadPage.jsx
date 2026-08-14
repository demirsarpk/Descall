import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconDownload,
  IconMonitor,
  IconSmartphone,
  IconLoader,
  IconSparkles,
  IconShield,
  IconGlobe,
  IconMessage,
  IconMic,
  IconVideo,
  IconUsers,
  IconCheck,
  IconGithub,
  IconStar,
  IconLogIn,
  IconZap,
} from "../icons";
import { fetchLatestDesktopRelease } from "../../lib/githubRelease";
import { formatReleaseLabel } from "../../lib/releaseVersion";
import { DESKTOP_RELEASE_FALLBACK } from "../../lib/desktopRelease";
import { useT } from "../../context/localeContextInstance";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import { SEO_PILLARS } from "../seoHubLinks";
import { Funnel } from "../analytics";
import { signalMarketingEngage } from "../analyticsGate";
import "../../components/download/DownloadPage.css";

const GITHUB_REPO = "demirsarpk/Descall";
const FALLBACK_WINDOWS_URL = DESKTOP_RELEASE_FALLBACK.windowsDownloadUrl;
const ANDROID_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

const FEATURES = [
  { icon: IconMessage, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: IconMic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: IconVideo, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: IconUsers, title: "Group Chats", desc: "Create groups with unlimited members" },
];

/**
 * Marketing download page — no lucide / framer-motion (keeps first-load JS lean).
 */
export default function MarketingDownloadPage({ onOpenRegister, onSignIn }) {
  const t = useT();
  const [selectedPlatform, setSelectedPlatform] = useState("windows");
  const [loading, setLoading] = useState(true);
  const [releaseLabel, setReleaseLabel] = useState("");
  const [windowsUrl, setWindowsUrl] = useState(FALLBACK_WINDOWS_URL);
  const [androidUrl, setAndroidUrl] = useState(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) setSelectedPlatform("android");
    else if (ua.includes("win")) setSelectedPlatform("windows");

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLatestDesktopRelease();
        if (cancelled) return;
        const win =
          data.windowsDownloadUrl && !/portable/i.test(data.windowsDownloadUrl)
            ? data.windowsDownloadUrl
            : FALLBACK_WINDOWS_URL;
        setWindowsUrl(win);
        setAndroidUrl(data.androidDownloadUrl || null);
        setReleaseLabel(formatReleaseLabel(data.tagName) || "");
      } catch {
        if (!cancelled) setWindowsUrl(FALLBACK_WINDOWS_URL);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadUrl =
    selectedPlatform === "android"
      ? androidUrl || ANDROID_RELEASES_PAGE_URL
      : windowsUrl || FALLBACK_WINDOWS_URL;

  const openAuth = () => {
    signalMarketingEngage({ source: "download", intent: "register" });
    Funnel.ctaClick({ page: "/download", placement: "download_hero", label: "start_free", intent: "register" });
    (onOpenRegister || onSignIn)?.({ mode: "register", source: "download" });
  };

  return (
    <div className="download-page">
      <div className="download-bg" aria-hidden>
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="grid-pattern" />
      </div>

      <section className="download-hero">
        <div className="hero-content">
          <div className="version-badge">
            {loading ? <IconLoader size={14} /> : <IconSparkles size={14} />}
            <span>
              {loading
                ? t("Checking for updates…")
                : releaseLabel
                  ? t("{label} available", { label: releaseLabel })
                  : t("Latest release")}
            </span>
          </div>

          <h1 className="hero-title">
            {t("Descall")} {t("Desktop")}
            <span className="gradient-text"> {t("Experience")}</span>
          </h1>
          <p className="hero-subtitle">
            {t("The ultimate chat application for your desktop. Fast, secure, and beautifully designed.")}
          </p>

          <button type="button" className="login-btn" onClick={openAuth}>
            <IconLogIn size={18} />
            <span>{t("Start free")}</span>
          </button>

          <div className="platform-tabs" role="tablist" aria-label={t("Platform")}>
            <button
              type="button"
              role="tab"
              aria-selected={selectedPlatform === "windows"}
              className={selectedPlatform === "windows" ? "is-active" : ""}
              onClick={() => setSelectedPlatform("windows")}
            >
              <IconMonitor size={18} /> Windows
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedPlatform === "android"}
              className={selectedPlatform === "android" ? "is-active" : ""}
              onClick={() => setSelectedPlatform("android")}
            >
              <IconSmartphone size={18} /> Android
            </button>
          </div>

          <a
            className="login-btn"
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              Funnel.ctaClick({
                page: "/download",
                placement: "download_primary",
                label: selectedPlatform,
                intent: "download",
              })
            }
          >
            <IconDownload size={20} />
            <span>
              {selectedPlatform === "android" ? t("Download APK") : t("Download for Windows")}
            </span>
          </a>

          <div className="download-trust">
            <span>
              <IconShield size={16} /> {t("Transport security")}: TLS
            </span>
            <span>
              <IconZap size={16} /> {t("Free")}
            </span>
            <span>
              <IconGlobe size={16} /> Web · Windows · Android
            </span>
            <a href={`https://github.com/${GITHUB_REPO}`} rel="noopener noreferrer" target="_blank">
              <IconGithub size={16} /> GitHub
            </a>
            <span>
              <IconStar size={16} /> Beta
            </span>
          </div>
        </div>
      </section>

      <section className="download-features">
        <h2>{t("Why download Descall")}</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div className="feature-card" key={f.title}>
                <Icon size={22} />
                <h3>{t(f.title)}</h3>
                <p>{t(f.desc)}</p>
              </div>
            );
          })}
        </div>
        <ul className="download-checklist">
          <li>
            <IconCheck size={16} /> {t("No Nitro paywall on core chat & calls")}
          </li>
          <li>
            <IconCheck size={16} /> {t("Servers, roles, channels, and Valorant LFG")}
          </li>
          <li>
            <IconCheck size={16} />{" "}
            <Link to="/discord-alternative">{t("Discord alternative")}</Link>
          </li>
        </ul>
      </section>

      <div className="download-related">
        <SeoRelatedLinks title={t("Keep exploring")} links={SEO_PILLARS} />
      </div>
    </div>
  );
}
