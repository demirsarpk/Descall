import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";

const GIPHY_API_KEY = "dtgxSdCkeVkjYcEeEpSYlqP4mmv4LQgi";
const GIPHY_API_URL = "https://api.giphy.com/v1/gifs";

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    pointerEvents: "none",
  },
  panel: {
    position: "absolute",
    bottom: 64,
    left: 8,
    width: 380,
    maxHeight: 480,
    background: "#1e1f23",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    pointerEvents: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  logo: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "0.08em",
    background: "linear-gradient(90deg, #00cdac, #8ddad5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#72767d",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "7px 10px 7px 32px",
    color: "#e3e5e8",
    fontSize: 13,
    outline: "none",
  },
  tabRow: {
    display: "flex",
    gap: 4,
    padding: "6px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 4,
    padding: 8,
    overflowY: "auto",
    flex: 1,
  },
  gifBtn: {
    position: "relative",
    border: "none",
    borderRadius: 8,
    overflow: "hidden",
    cursor: "pointer",
    padding: 0,
    background: "#2b2d33",
    aspectRatio: "1 / 1",
  },
  gifImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  footer: {
    padding: "6px 12px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
    textAlign: "right",
  },
};

export default function GiphyPicker({ isOpen, onClose, onSelectGif }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("trending");
  const [hoveredId, setHoveredId] = useState(null);
  const searchInputRef = useRef(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`);
      if (!res.ok) throw new Error("Failed to fetch trending GIFs");
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchGifs = useCallback(async (query) => {
    if (!query.trim()) { fetchTrending(); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=g`);
      if (!res.ok) throw new Error("Failed to search GIFs");
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchTrending]);

  useEffect(() => {
    if (isOpen) {
      fetchTrending();
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setSearchQuery("");
      setActiveTab("trending");
    }
  }, [isOpen, fetchTrending]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery) { searchGifs(searchQuery); setActiveTab("search"); }
      else if (activeTab === "search") { fetchTrending(); setActiveTab("trending"); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchGifs, fetchTrending, activeTab]);

  const handleSelect = (gif) => {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
    const previewUrl = gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url;
    if (!gifUrl) return;
    onSelectGif({ url: gifUrl, previewUrl: previewUrl || gifUrl, title: gif.title, id: gif.id, source: "giphy" });
    onClose();
    setSearchQuery("");
  };

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={S.panel} onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <span style={S.logo}>GIPHY</span>
          <button style={S.closeBtn} onClick={onClose}
            onMouseEnter={e => e.currentTarget.style.color = "#e3e5e8"}
            onMouseLeave={e => e.currentTarget.style.color = "#72767d"}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={S.searchRow}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#72767d", pointerEvents: "none" }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search GIFs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={S.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); fetchTrending(); setActiveTab("trending"); }}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#72767d", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabRow}>
          {[
            { id: "trending", label: "Trending", icon: <TrendingUp size={13} /> },
            { id: "search",   label: "Search",   icon: <Search size={13} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "trending") { setActiveTab("trending"); setSearchQuery(""); fetchTrending(); }
                else searchInputRef.current?.focus();
              }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 500,
                background: activeTab === tab.id ? "rgba(255,255,255,0.1)" : "none",
                color: activeTab === tab.id ? "#e3e5e8" : "#72767d",
                transition: "all 0.12s",
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={S.grid}>
          {loading ? (
            <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, color: "#72767d" }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13 }}>Loading GIFs…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, color: "#ed4245" }}>
              <p style={{ fontSize: 13, marginBottom: 10 }}>{error}</p>
              <button onClick={fetchTrending} style={{ background: "#5865f2", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
                Retry
              </button>
            </div>
          ) : gifs.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, color: "#72767d", fontSize: 13 }}>
              No GIFs found. Try a different search.
            </div>
          ) : gifs.map((gif) => (
            <button
              key={gif.id}
              title={gif.title}
              onClick={() => handleSelect(gif)}
              onMouseEnter={() => setHoveredId(gif.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                ...S.gifBtn,
                transform: hoveredId === gif.id ? "scale(1.04)" : "scale(1)",
                transition: "transform 0.12s",
                outline: hoveredId === gif.id ? "2px solid #5865f2" : "2px solid transparent",
              }}
            >
              <img
                src={gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url}
                alt={gif.title}
                loading="lazy"
                style={S.gifImg}
              />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={{ fontSize: 10, color: "#4f545c", fontWeight: 600, letterSpacing: "0.04em" }}>Powered by GIPHY</span>
        </div>
      </div>
    </div>
  );
}
