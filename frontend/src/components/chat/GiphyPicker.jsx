import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";
import { useT } from "../../context/LocaleContext";

const GIPHY_API_KEY = "dtgxSdCkeVkjYcEeEpSYlqP4mmv4LQgi";
const GIPHY_API_URL = "https://api.giphy.com/v1/gifs";

export default function GiphyPicker({ isOpen, onClose, onSelectGif, anchorRef }) {
  const t = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("trending");
  const [panelPos, setPanelPos] = useState({ bottom: 72, left: 16, width: 400 });
  const searchInputRef = useRef(null);
  const panelRef = useRef(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=g`);
      if (!res.ok) throw new Error(t("Failed to fetch trending GIFs"));
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const searchGifs = useCallback(async (query) => {
    if (!query.trim()) {
      fetchTrending();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30&rating=g`
      );
      if (!res.ok) throw new Error(t("Failed to search GIFs"));
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchTrending, t]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setActiveTab("trending");
      return;
    }
    fetchTrending();
    const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen, fetchTrending]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const place = () => {
      const anchor = anchorRef?.current;
      const width = Math.min(420, window.innerWidth - 24);
      if (!anchor) {
        setPanelPos({ bottom: 72, left: 16, width });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      let left = rect.left;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      const bottom = Math.max(12, window.innerHeight - rect.top + 10);
      setPanelPos({ bottom, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchGifs(searchQuery);
        setActiveTab("search");
      } else if (activeTab === "search") {
        fetchTrending();
        setActiveTab("trending");
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, searchGifs, fetchTrending, activeTab]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSelect = (gif) => {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
    const previewUrl = gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url;
    if (!gifUrl) return;
    onSelectGif?.({
      url: gifUrl,
      previewUrl: previewUrl || gifUrl,
      title: gif.title,
      id: gif.id,
      source: "giphy",
    });
    onClose?.();
    setSearchQuery("");
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="giphy-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            className="giphy-panel"
            role="dialog"
            aria-label={t("GIF picker")}
            style={{
              bottom: panelPos.bottom,
              left: panelPos.left,
              width: panelPos.width,
            }}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="giphy-header">
              <div className="giphy-brand">
                <span className="giphy-logo">GIPHY</span>
                <span className="giphy-sub">{t("Pick a GIF")}</span>
              </div>
              <button type="button" className="giphy-close" onClick={onClose} aria-label={t("Close")}>
                <X size={16} />
              </button>
            </header>

            <div className="giphy-search">
              <Search size={15} className="giphy-search-ico" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t("Search GIFs…")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="giphy-search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    fetchTrending();
                    setActiveTab("trending");
                  }}
                  aria-label={t("Clear search")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="giphy-tabs">
              <button
                type="button"
                className={activeTab === "trending" ? "active" : ""}
                onClick={() => {
                  setActiveTab("trending");
                  setSearchQuery("");
                  fetchTrending();
                }}
              >
                <TrendingUp size={13} />
                {t("Trending")}
              </button>
              <button
                type="button"
                className={activeTab === "search" ? "active" : ""}
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search size={13} />
                {t("Search")}
              </button>
            </div>

            <div className="giphy-grid">
              {loading ? (
                <div className="giphy-state">
                  <Loader2 size={26} className="giphy-spin" />
                  <span>{t("Loading GIFs…")}</span>
                </div>
              ) : error ? (
                <div className="giphy-state is-error">
                  <p>{error}</p>
                  <button type="button" onClick={fetchTrending}>
                    {t("Retry")}
                  </button>
                </div>
              ) : gifs.length === 0 ? (
                <div className="giphy-state">{t("No GIFs found. Try another search.")}</div>
              ) : (
                gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    className="giphy-cell"
                    title={gif.title}
                    onClick={() => handleSelect(gif)}
                  >
                    <img
                      src={
                        gif.images?.fixed_width_small?.url ||
                        gif.images?.fixed_height_small?.url ||
                        gif.images?.preview_gif?.url
                      }
                      alt={gif.title || "GIF"}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </button>
                ))
              )}
            </div>

            <footer className="giphy-footer">{t("Powered by GIPHY")}</footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
