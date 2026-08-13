import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Plus, RefreshCw, Users, Mic, Filter, X, Gamepad2,
  LogOut, Phone, MessageSquare, Shield, ChevronLeft, ArrowLeft,
} from "lucide-react";
import {
  getLfgMeta,
  listLfgLobbies,
  createLfgLobby,
  joinLfgLobby,
  leaveLfgLobby,
  getLfgLobby,
  updateLfgLobby,
} from "../../api/lfg";
import { getRiotStatus } from "../../api/riot";
import { Avatar } from "../ui/Avatar";
import PartyCodeReveal from "./PartyCodeReveal";
import { useT } from "../../context/LocaleContext";

const FALLBACK_RANKS = [
  "Iron 1", "Iron 2", "Iron 3",
  "Bronze 1", "Bronze 2", "Bronze 3",
  "Silver 1", "Silver 2", "Silver 3",
  "Gold 1", "Gold 2", "Gold 3",
  "Platinum 1", "Platinum 2", "Platinum 3",
  "Diamond 1", "Diamond 2", "Diamond 3",
  "Ascendant 1", "Ascendant 2", "Ascendant 3",
  "Immortal 1", "Immortal 2", "Immortal 3",
  "Radiant",
];

function modeLabel(modes, id) {
  return modes?.find((m) => m.id === id)?.label || id;
}

function regionLabel(regions, id) {
  return regions?.find((r) => r.id === id)?.label || id;
}

function trLabel(t, label) {
  return label ? t(label) : label;
}

export default function LfgWorkspace({
  me,
  socket,
  onOpenGroup,
  onJoinVoice,
  onGroupCreated,
  onClose,
}) {
  const t = useT();
  const [meta, setMeta] = useState({
    ranks: FALLBACK_RANKS,
    modes: [
      { id: "competitive", label: "Competitive" },
      { id: "unrated", label: "Unrated" },
      { id: "swiftplay", label: "Swiftplay" },
      { id: "spikerush", label: "Spike Rush" },
    ],
    regions: [
      { id: "eu", label: "Europe" },
      { id: "tr", label: "Turkey" },
      { id: "na", label: "North America" },
    ],
    roles: ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"],
  });
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ mode: "", region: "eu", mic: "", myRank: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [joinRank, setJoinRank] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [linkedRank, setLinkedRank] = useState("");
  const [linkedRegion, setLinkedRegion] = useState("");

  const ranks = meta.ranks?.length ? meta.ranks : FALLBACK_RANKS;
  const filterCount = [filters.mode, filters.region, filters.myRank, filters.mic].filter(Boolean).length;

  const clearLobbySelection = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listLfgLobbies({
        mode: filters.mode || undefined,
        region: filters.region || undefined,
        mic: filters.mic || undefined,
        myRank: filters.myRank || undefined,
      });
      setLobbies(data.lobbies || []);
    } catch (err) {
      setError(err.message || t("Failed to load lobbies"));
    } finally {
      setLoading(false);
    }
  }, [filters.mode, filters.region, filters.mic, filters.myRank]);

  useEffect(() => {
    getLfgMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    getRiotStatus()
      .then((res) => {
        const rank = res.valorant?.rankTier || res.valorant?.rank || "";
        const region = res.valorant?.region || "";
        if (rank) {
          setLinkedRank(rank);
          setFilters((f) => ({ ...f, myRank: f.myRank || rank }));
          setJoinRank((j) => j || rank);
        }
        if (region && ["eu", "na", "ap", "tr"].includes(region)) {
          setLinkedRegion(region);
          setFilters((f) => ({
            ...f,
            region: f.region || region,
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!socket) return undefined;
    const onCreated = () => refreshList();
    const onUpdated = ({ lobby } = {}) => {
      if (!lobby?.id) return refreshList();
      setLobbies((prev) => {
        const idx = prev.findIndex((l) => l.id === lobby.id);
        if (lobby.status && lobby.status !== "open" && lobby.status !== "full") {
          return prev.filter((l) => l.id !== lobby.id);
        }
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...lobby };
        return next;
      });
      if (selectedId === lobby.id) {
        getLfgLobby(lobby.id)
          .then((res) => setDetail(res))
          .catch(() => {});
      }
    };
    const onClosed = ({ lobbyId } = {}) => {
      setLobbies((prev) => prev.filter((l) => l.id !== lobbyId));
      if (selectedId === lobbyId) setDetail((d) => (d ? { ...d, lobby: { ...d.lobby, status: "closed" } } : d));
    };
    socket.on("lfg:lobby:created", onCreated);
    socket.on("lfg:lobby:updated", onUpdated);
    socket.on("lfg:lobby:closed", onClosed);
    return () => {
      socket.off("lfg:lobby:created", onCreated);
      socket.off("lfg:lobby:updated", onUpdated);
      socket.off("lfg:lobby:closed", onClosed);
    };
  }, [socket, refreshList, selectedId]);

  const openLobby = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setError("");
    try {
      const res = await getLfgLobby(id);
      setDetail(res);
      if (res.lobby?.hostRank && !joinRank) setJoinRank(filters.myRank || res.lobby.hostRank);
    } catch (err) {
      setError(err.message || t("Failed to open lobby"));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (form) => {
    setBusy(true);
    setError("");
    try {
      const res = await createLfgLobby(form);
      setShowCreate(false);
      if (res.group) onGroupCreated?.(res.group);
      await refreshList();
      if (res.lobby?.id) {
        setDetail(res);
        setSelectedId(res.lobby.id);
      }
    } catch (err) {
      setError(err.message || t("Failed to create lobby"));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      const res = await joinLfgLobby(selectedId, { myRank: joinRank || filters.myRank });
      setDetail(res);
      if (res.group) {
        onGroupCreated?.(res.group);
      }
      await refreshList();
    } catch (err) {
      setError(err.message || t("Failed to join"));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedId) return;
    const closingAsHost = detail?.isHost;
    if (closingAsHost) {
      const ok = window.confirm(t("Close this lobby for everyone? Only you (the host) can do this."));
      if (!ok) return;
    }
    setBusy(true);
    try {
      await leaveLfgLobby(selectedId);
      setDetail(null);
      setSelectedId(null);
      await refreshList();
    } catch (err) {
      setError(err.message || t("Failed to leave"));
    } finally {
      setBusy(false);
    }
  };

  const savePartyCode = async (partyCode) => {
    if (!selectedId) return;
    const res = await updateLfgLobby(selectedId, { partyCode });
    setDetail((prev) => ({
      ...prev,
      lobby: res.lobby,
      isHost: prev?.isHost,
      isMember: true,
    }));
  };

  return (
    <div className={`lfg-workspace${selectedId ? " has-selection" : ""}`}>
      <aside className="lfg-sidebar">
        <header className="lfg-sidebar-header">
          <div className="lfg-sidebar-title">
            {onClose && (
              <button
                type="button"
                className="lfg-back-btn"
                onClick={onClose}
                title={t("Back to Descall")}
                aria-label={t("Back to Descall")}
              >
                <ArrowLeft size={18} />
                <span className="lfg-back-label">{t("Descall")}</span>
              </button>
            )}
            <div>
              <div className="lfg-kicker">{t("Valorant")}</div>
              <h2>{t("Find a stack")}</h2>
            </div>
          </div>
          <div className="lfg-sidebar-actions">
            <button type="button" className="icon-btn" title={t("Refresh")} onClick={refreshList}>
              <RefreshCw size={16} className={loading ? "spin" : undefined} />
            </button>
            <button type="button" className="lfg-btn primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> {t("Create")}
            </button>
          </div>
        </header>

        <div className="lfg-filters-bar">
          <button
            type="button"
            className={`lfg-filters-toggle${filtersOpen ? " open" : ""}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <Filter size={14} />
            <span>{t("Filters")}{filterCount ? ` · ${filterCount}` : ""}</span>
          </button>
          <div className={`lfg-filters${filtersOpen ? " is-open" : ""}`}>
            <select
              value={filters.mode}
              onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value }))}
            >
              <option value="">{t("All modes")}</option>
              {(meta.modes || []).map((m) => (
                <option key={m.id} value={m.id}>{trLabel(t, m.label)}</option>
              ))}
            </select>
            <select
              value={filters.region}
              onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}
            >
              <option value="">{t("All regions")}</option>
              {(meta.regions || []).map((r) => (
                <option key={r.id} value={r.id}>{trLabel(t, r.label)}</option>
              ))}
            </select>
            <select
              value={filters.myRank}
              onChange={(e) => setFilters((f) => ({ ...f, myRank: e.target.value }))}
            >
              <option value="">{t("My rank (filter)")}</option>
              {ranks.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <label className="lfg-mic-filter">
              <input
                type="checkbox"
                checked={filters.mic === "1"}
                onChange={(e) => setFilters((f) => ({ ...f, mic: e.target.checked ? "1" : "" }))}
              />
              {t("Mic required")}
            </label>
          </div>
        </div>

        <div className="lfg-lobby-list">
          {loading && !lobbies.length ? (
            <div className="lfg-empty">{t("Loading lobbies…")}</div>
          ) : lobbies.length === 0 ? (
            <div className="lfg-empty">
              <Crosshair size={28} />
              <strong>{t("No open lobbies")}</strong>
              <span>{t("Create one and share Descall — voice + party code in one place.")}</span>
              <button type="button" className="lfg-btn primary" onClick={() => setShowCreate(true)}>
                {t("Create lobby")}
              </button>
            </div>
          ) : (
            lobbies.map((lobby) => (
              <button
                key={lobby.id}
                type="button"
                className={`lfg-lobby-card ${selectedId === lobby.id ? "active" : ""}`}
                onClick={() => openLobby(lobby.id)}
              >
                <div className="lfg-lobby-card-top">
                  <span className="lfg-mode">{trLabel(t, modeLabel(meta.modes, lobby.mode))}</span>
                  <span className="lfg-slots">
                    <Users size={12} />
                    {lobby.partySizeCurrent}/{lobby.partySizeMax}
                  </span>
                </div>
                <div className="lfg-lobby-card-rank">
                  {lobby.rankMin} – {lobby.rankMax}
                </div>
                <div className="lfg-lobby-card-meta">
                  <span>{lobby.hostUsername}</span>
                  <span>{trLabel(t, regionLabel(meta.regions, lobby.region))}</span>
                  {lobby.micRequired && <span className="lfg-mic-tag"><Mic size={11} /> {t("Mic")}</span>}
                  {lobby.hasPartyCode && <span className="lfg-code-tag">{t("Code set")}</span>}
                </div>
                {lobby.note ? <p className="lfg-lobby-note">{lobby.note}</p> : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <main className={`lfg-main${selectedId ? " is-open" : ""}`}>
        {error && <div className="lfg-error-banner">{error}</div>}

        {selectedId && (
          <button
            type="button"
            className="lfg-mobile-detail-back"
            onClick={clearLobbySelection}
          >
            <ChevronLeft size={18} /> {t("Back to list")}
          </button>
        )}

        {!selectedId ? (
          <div className="lfg-main-empty">
            <Gamepad2 size={40} />
            <h3>{t("Valorant LFG")}</h3>
            <p>
              {t("Browse stacks, join the Descall voice lobby, then reveal the Valorant party code. Everything stays inside Descall — not a separate site.")}
            </p>
          </div>
        ) : detailLoading || !detail?.lobby ? (
          <div className="lfg-main-empty">{t("Loading lobby…")}</div>
        ) : (
          <LobbyDetail
            detail={detail}
            meta={meta}
            ranks={ranks}
            joinRank={joinRank}
            setJoinRank={setJoinRank}
            busy={busy}
            me={me}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onSavePartyCode={savePartyCode}
            onOpenChat={() => {
              if (detail.lobby?.groupId) {
                onOpenGroup?.({
                  id: detail.lobby.groupId,
                  name: detail.lobby.note || `VAL ${detail.lobby.mode}`,
                });
              }
            }}
            onJoinVoice={() => {
              if (detail.lobby?.groupId) {
                const g = {
                  id: detail.lobby.groupId,
                  name: `VAL ${modeLabel(meta.modes, detail.lobby.mode)}`,
                };
                onGroupCreated?.(g);
                onJoinVoice?.(g);
              }
            }}
          />
        )}
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateLobbyModal
            meta={meta}
            ranks={ranks}
            busy={busy}
            defaultHostRank={linkedRank || filters.myRank || "Gold 2"}
            defaultRegion={linkedRegion || filters.region || "eu"}
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LobbyDetail({
  detail,
  meta,
  ranks,
  joinRank,
  setJoinRank,
  busy,
  me,
  onJoin,
  onLeave,
  onSavePartyCode,
  onOpenChat,
  onJoinVoice,
}) {
  const t = useT();
  const lobby = detail.lobby;
  const isMember = detail.isMember;
  const isHost = detail.isHost;
  const closed = lobby.status === "closed";

  return (
    <div className="lfg-detail">
      <header className="lfg-detail-header">
        <div>
          <div className="lfg-kicker">{t("Lobby")} · {t(lobby.status)}</div>
          <h2>{trLabel(t, modeLabel(meta.modes, lobby.mode))}</h2>
          <p>
            {lobby.rankMin} – {lobby.rankMax} · {trLabel(t, regionLabel(meta.regions, lobby.region))}
            {lobby.micRequired ? ` · ${t("Mic required")}` : ""}
          </p>
        </div>
        <div className="lfg-detail-slots">
          <Users size={18} />
          {lobby.partySizeCurrent}/{lobby.partySizeMax}
        </div>
      </header>

      {lobby.note ? <div className="lfg-detail-note">{lobby.note}</div> : null}

      <section className="lfg-members">
        <h3>{t("Players")}</h3>
        <div className="lfg-member-grid">
          {(lobby.members || []).map((m) => (
            <div key={m.userId} className="lfg-member">
              <Avatar name={m.username} size={36} user={{ avatarUrl: m.avatarUrl, username: m.username }} />
              <div>
                <strong>{m.username}{m.userId === me?.id ? t(" (you)") : ""}</strong>
                <span>{m.rank || "—"}{m.role ? ` · ${m.role}` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isMember ? (
        <PartyCodeReveal
          code={lobby.partyCode}
          hasCode={lobby.hasPartyCode || Boolean(lobby.partyCode)}
          canEdit={isHost && !closed}
          onSave={onSavePartyCode}
        />
      ) : (
        <div className="lfg-party-code is-locked">
          <Shield size={16} />
          <span>{t("Join the lobby to reveal the Valorant party code")}</span>
        </div>
      )}

      <div className="lfg-detail-actions">
        {!isMember && !closed && (
          <>
            <select value={joinRank} onChange={(e) => setJoinRank(e.target.value)}>
              <option value="">{t("Your rank")}</option>
              {ranks.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="button" className="lfg-btn primary" disabled={busy || !joinRank} onClick={onJoin}>
              {t("Join lobby")}
            </button>
          </>
        )}
        {isMember && (
          <>
            <button type="button" className="lfg-btn primary" onClick={onJoinVoice}>
              <Phone size={15} /> {t("Join voice")}
            </button>
            <button type="button" className="lfg-btn ghost" onClick={onOpenChat}>
              <MessageSquare size={15} /> {t("Open chat")}
            </button>
            <button type="button" className="lfg-btn danger" disabled={busy} onClick={onLeave}>
              <LogOut size={15} /> {isHost ? t("Close lobby") : t("Leave")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateLobbyModal({ meta, ranks, busy, defaultHostRank, defaultRegion, onClose, onSubmit }) {
  const t = useT();
  const hostRank = defaultHostRank && ranks.includes(defaultHostRank) ? defaultHostRank : "Gold 2";
  const hostIdx = ranks.indexOf(hostRank);
  const rankMin = ranks[Math.max(0, hostIdx - 2)] || "Gold 1";
  const rankMax = ranks[Math.min(ranks.length - 1, hostIdx + 3)] || "Platinum 3";
  const [form, setForm] = useState({
    mode: "competitive",
    region: defaultRegion || "eu",
    hostRank,
    rankMin,
    rankMax,
    partySizeCurrent: 1,
    partySizeMax: 5,
    micRequired: true,
    partyCode: "",
    note: "",
    needRoles: [],
  });

  const toggleRole = (role) => {
    setForm((f) => ({
      ...f,
      needRoles: f.needRoles.includes(role)
        ? f.needRoles.filter((r) => r !== role)
        : [...f.needRoles, role],
    }));
  };

  return (
    <motion.div
      className="lfg-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="lfg-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <header>
          <h3>{t("Create Valorant lobby")}</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="lfg-modal-body">
          <div className="lfg-form-grid">
            <label>
              {t("Mode")}
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {(meta.modes || []).map((m) => (
                  <option key={m.id} value={m.id}>{trLabel(t, m.label)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Region")}
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {(meta.regions || []).map((r) => (
                  <option key={r.id} value={r.id}>{trLabel(t, r.label)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Your rank")}
              <select value={form.hostRank} onChange={(e) => setForm({ ...form, hostRank: e.target.value })}>
                {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>
              {t("Looking for (min)")}
              <select value={form.rankMin} onChange={(e) => setForm({ ...form, rankMin: e.target.value })}>
                {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>
              {t("Looking for (max)")}
              <select value={form.rankMax} onChange={(e) => setForm({ ...form, rankMax: e.target.value })}>
                {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>
              {t("We are (players already)")}
              <input
                type="number"
                min={1}
                max={5}
                value={form.partySizeCurrent}
                onChange={(e) => setForm({ ...form, partySizeCurrent: Number(e.target.value) || 1 })}
              />
            </label>
            <label>
              {t("Party max")}
              <input
                type="number"
                min={2}
                max={5}
                value={form.partySizeMax}
                onChange={(e) => setForm({ ...form, partySizeMax: Number(e.target.value) || 5 })}
              />
            </label>
            <label className="lfg-check">
              <input
                type="checkbox"
                checked={form.micRequired}
                onChange={(e) => setForm({ ...form, micRequired: e.target.checked })}
              />
              {t("Mic required")}
            </label>
          </div>

          <label className="lfg-full">
            {t("Valorant party code (optional — can add later)")}
            <input
              value={form.partyCode}
              onChange={(e) => setForm({ ...form, partyCode: e.target.value })}
              placeholder={t("Players reveal this after joining")}
              maxLength={32}
            />
          </label>

          <label className="lfg-full">
            {t("Note")}
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t("chill / rank push / TR only…")}
              maxLength={160}
            />
          </label>

          <div className="lfg-roles">
            <span>{t("Need roles")}</span>
            <div>
              {(meta.roles || []).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={form.needRoles.includes(role) ? "active" : ""}
                  onClick={() => toggleRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer>
          <button type="button" className="lfg-btn ghost" onClick={onClose}>{t("Cancel")}</button>
          <button
            type="button"
            className="lfg-btn primary"
            disabled={busy}
            onClick={() => onSubmit(form)}
          >
            {busy ? t("Creating…") : t("Create lobby")}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
