import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Plus, RefreshCw, ShoppingBag, Search, CheckCircle2, XCircle, Coins, Sparkles } from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import { grantDesCoin } from "../../api/shop";
import RippleButton from "../ui/RippleButton";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";

const CATEGORIES = [
  { id: "banner", label: "Banner" },
  { id: "avatar_frame", label: "Avatar Frame" },
  { id: "profile_background", label: "Profile Background" },
  { id: "theme", label: "Premium Theme" },
];

const RARITIES = ["common", "rare", "epic", "legendary"];

const EMPTY_DRAFT = {
  sku: "",
  name: "",
  description: "",
  category: "banner",
  assetUrl: "",
  previewUrl: "",
  priceDescoin: "250",
  themeKey: "",
  rarity: "common",
};

function formatDescoin(amount) {
  return `${(Number(amount) || 0).toLocaleString()} DesCoin`;
}

export default function AdminShop() {
  const t = useT();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);

  // Gift flow
  const [giftUserQuery, setGiftUserQuery] = useState("");
  const [giftUserResults, setGiftUserResults] = useState([]);
  const [giftSearching, setGiftSearching] = useState(false);
  const [giftTargetUser, setGiftTargetUser] = useState(null);
  const [giftItemId, setGiftItemId] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftSending, setGiftSending] = useState(false);
  const [giftNotice, setGiftNotice] = useState("");

  // DesCoin grant/revoke flow
  const [coinUserQuery, setCoinUserQuery] = useState("");
  const [coinUserResults, setCoinUserResults] = useState([]);
  const [coinSearching, setCoinSearching] = useState(false);
  const [coinTargetUser, setCoinTargetUser] = useState(null);
  const [coinAmount, setCoinAmount] = useState("100");
  const [coinReason, setCoinReason] = useState("");
  const [coinSending, setCoinSending] = useState(false);
  const [coinNotice, setCoinNotice] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await adminFetch("/shop/items");
      setItems(d.items || []);
    } catch (err) {
      setError(err.message || "Failed to load shop items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const activeCatalog = useMemo(() => items.filter((i) => i.active), [items]);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!draft.sku.trim() || !draft.name.trim() || !draft.assetUrl.trim()) return;
    if (draft.category === "theme" && !draft.themeKey.trim()) return;
    setCreating(true);
    try {
      await adminFetch("/shop/items", {
        method: "POST",
        body: JSON.stringify({
          sku: draft.sku.trim(),
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          category: draft.category,
          assetUrl: draft.assetUrl.trim(),
          previewUrl: draft.previewUrl.trim() || draft.assetUrl.trim(),
          priceDescoin: Math.max(0, Math.round(Number(draft.priceDescoin) || 0)),
          themeKey: draft.category === "theme" ? draft.themeKey.trim() : undefined,
          rarity: draft.rarity,
        }),
      });
      setDraft(EMPTY_DRAFT);
      setShowCreateForm(false);
      await loadItems();
    } catch (err) {
      setError(err.message || "Failed to create item.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      await adminFetch(`/shop/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)));
    } catch (err) {
      setError(err.message || "Failed to update item.");
    }
  };

  const searchGiftUsers = useCallback(async () => {
    if (!giftUserQuery.trim()) {
      setGiftUserResults([]);
      return;
    }
    setGiftSearching(true);
    try {
      const d = await adminFetch(`/users?q=${encodeURIComponent(giftUserQuery.trim())}&limit=8`);
      setGiftUserResults(d.users || []);
    } catch {
      setGiftUserResults([]);
    } finally {
      setGiftSearching(false);
    }
  }, [giftUserQuery]);

  useEffect(() => {
    const id = setTimeout(searchGiftUsers, 300);
    return () => clearTimeout(id);
  }, [searchGiftUsers]);

  const searchCoinUsers = useCallback(async () => {
    if (!coinUserQuery.trim()) {
      setCoinUserResults([]);
      return;
    }
    setCoinSearching(true);
    try {
      const d = await adminFetch(`/users?q=${encodeURIComponent(coinUserQuery.trim())}&limit=8`);
      setCoinUserResults(d.users || []);
    } catch {
      setCoinUserResults([]);
    } finally {
      setCoinSearching(false);
    }
  }, [coinUserQuery]);

  useEffect(() => {
    const id = setTimeout(searchCoinUsers, 300);
    return () => clearTimeout(id);
  }, [searchCoinUsers]);

  const handleGrantCoins = async (sign) => {
    const parsed = Math.round(Number(coinAmount));
    if (!coinTargetUser || !Number.isFinite(parsed) || parsed <= 0) return;
    setCoinSending(true);
    setCoinNotice("");
    try {
      const res = await grantDesCoin(coinTargetUser.id, parsed * sign, coinReason.trim() || null);
      setCoinNotice(
        t("{name}'s new balance: {balance} DesCoin", {
          name: coinTargetUser.username,
          balance: res.balance,
        })
      );
      setCoinReason("");
    } catch (err) {
      setCoinNotice(err.message || t("Failed to update DesCoin balance."));
    } finally {
      setCoinSending(false);
    }
  };

  const handleSendGift = async () => {
    if (!giftTargetUser || !giftItemId) return;
    setGiftSending(true);
    setGiftNotice("");
    try {
      await adminFetch("/shop/gift", {
        method: "POST",
        body: JSON.stringify({ userId: giftTargetUser.id, itemId: giftItemId, message: giftMessage.trim() || null }),
      });
      setGiftNotice(t("Gift sent to {name}!", { name: giftTargetUser.username }));
      setGiftTargetUser(null);
      setGiftUserQuery("");
      setGiftUserResults([]);
      setGiftItemId("");
      setGiftMessage("");
    } catch (err) {
      setGiftNotice(err.message || t("Failed to send gift."));
    } finally {
      setGiftSending(false);
    }
  };

  return (
    <section className="admin-section admin-shop-section">
      <div className="activity-header">
        <div className="activity-title-section">
          <h2><ShoppingBag size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} /> {t("Shop")}</h2>
          <p className="activity-subtitle">{t("Manage the cosmetics catalog and gift items to users.")}</p>
        </div>
        <RippleButton type="button" onClick={loadItems} disabled={loading} className="refresh-btn">
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {t("Refresh")}
        </RippleButton>
      </div>

      {error && (
        <div className="admin-feedback-error-banner">
          <XCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* DesCoin grant/revoke card */}
      <motion.div className="admin-card admin-shop-gift-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h3><Coins size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {t("Grant / revoke DesCoin")}</h3>
        <div className="admin-shop-gift-grid">
          <div className="admin-shop-gift-field">
            <label>{t("User")}</label>
            {coinTargetUser ? (
              <div className="admin-shop-selected-user">
                <Avatar name={coinTargetUser.username} size={28} user={coinTargetUser} />
                <span>{coinTargetUser.username}</span>
                <button type="button" onClick={() => setCoinTargetUser(null)}>
                  <XCircle size={14} />
                </button>
              </div>
            ) : (
              <div className="admin-shop-user-search">
                <Search size={14} />
                <input
                  className="admin-input"
                  placeholder={t("Search username…")}
                  value={coinUserQuery}
                  onChange={(e) => setCoinUserQuery(e.target.value)}
                />
                {coinSearching && <RefreshCw size={13} className="spin" />}
              </div>
            )}
            {!coinTargetUser && coinUserResults.length > 0 && (
              <div className="admin-shop-user-results">
                {coinUserResults.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className="admin-shop-user-result"
                    onClick={() => {
                      setCoinTargetUser(u);
                      setCoinUserResults([]);
                    }}
                  >
                    <Avatar name={u.username} size={24} user={u} />
                    <span>{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-shop-gift-field">
            <label>{t("Amount")}</label>
            <input
              className="admin-input"
              type="number"
              min="1"
              step="1"
              value={coinAmount}
              onChange={(e) => setCoinAmount(e.target.value)}
            />
          </div>

          <div className="admin-shop-gift-field admin-shop-gift-field-wide">
            <label>{t("Reason (optional)")}</label>
            <input
              className="admin-input"
              placeholder={t("e.g. compensation, event reward…")}
              value={coinReason}
              onChange={(e) => setCoinReason(e.target.value)}
            />
          </div>
        </div>

        {coinNotice && <p className="admin-shop-gift-notice">{coinNotice}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <RippleButton
            type="button"
            className="admin-btn-green"
            onClick={() => handleGrantCoins(1)}
            disabled={coinSending || !coinTargetUser}
          >
            {coinSending ? t("Working…") : t("Grant DesCoin")}
          </RippleButton>
          <RippleButton
            type="button"
            className="admin-btn-red"
            onClick={() => handleGrantCoins(-1)}
            disabled={coinSending || !coinTargetUser}
          >
            {coinSending ? t("Working…") : t("Revoke DesCoin")}
          </RippleButton>
        </div>
      </motion.div>

      {/* Gift item card */}
      <motion.div className="admin-card admin-shop-gift-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h3><Gift size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {t("Gift an item")}</h3>
        <div className="admin-shop-gift-grid">
          <div className="admin-shop-gift-field">
            <label>{t("Recipient")}</label>
            {giftTargetUser ? (
              <div className="admin-shop-selected-user">
                <Avatar name={giftTargetUser.username} size={28} user={giftTargetUser} />
                <span>{giftTargetUser.username}</span>
                <button type="button" onClick={() => setGiftTargetUser(null)}>
                  <XCircle size={14} />
                </button>
              </div>
            ) : (
              <div className="admin-shop-user-search">
                <Search size={14} />
                <input
                  className="admin-input"
                  placeholder={t("Search username…")}
                  value={giftUserQuery}
                  onChange={(e) => setGiftUserQuery(e.target.value)}
                />
                {giftSearching && <RefreshCw size={13} className="spin" />}
              </div>
            )}
            {!giftTargetUser && giftUserResults.length > 0 && (
              <div className="admin-shop-user-results">
                {giftUserResults.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className="admin-shop-user-result"
                    onClick={() => {
                      setGiftTargetUser(u);
                      setGiftUserResults([]);
                    }}
                  >
                    <Avatar name={u.username} size={24} user={u} />
                    <span>{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-shop-gift-field">
            <label>{t("Item")}</label>
            <select className="admin-select" value={giftItemId} onChange={(e) => setGiftItemId(e.target.value)}>
              <option value="">{t("Select an item…")}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({CATEGORIES.find((c) => c.id === item.category)?.label || item.category})
                </option>
              ))}
            </select>
          </div>

          <div className="admin-shop-gift-field admin-shop-gift-field-wide">
            <label>{t("Message (optional)")}</label>
            <textarea
              className="admin-textarea"
              rows={2}
              placeholder={t("A note to include with the gift…")}
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
            />
          </div>
        </div>

        {giftNotice && <p className="admin-shop-gift-notice">{giftNotice}</p>}

        <RippleButton
          type="button"
          className="admin-btn-green"
          onClick={handleSendGift}
          disabled={giftSending || !giftTargetUser || !giftItemId}
        >
          {giftSending ? t("Sending…") : t("Send gift")}
        </RippleButton>
      </motion.div>

      {/* Catalog */}
      <div className="activity-header" style={{ marginTop: 24 }}>
        <div className="activity-title-section">
          <h3>{t("Catalog")} ({activeCatalog.length}/{items.length} {t("active")})</h3>
        </div>
        <RippleButton type="button" onClick={() => setShowCreateForm((v) => !v)}>
          <Plus size={15} /> {t("New item")}
        </RippleButton>
      </div>

      {showCreateForm && (
        <motion.form
          className="admin-card admin-shop-create-form"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={handleCreateItem}
        >
          <div className="admin-shop-gift-grid">
            <input className="admin-input" placeholder="sku (e.g. banner-forest)" value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} required />
            <input className="admin-input" placeholder={t("Name")} value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
            <select className="admin-select" value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value, themeKey: e.target.value === "theme" ? d.themeKey : "" }))}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select className="admin-select" value={draft.rarity}
              onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))}>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="admin-input" type="number" min="0" step="1" placeholder={t("Price (DesCoin)")}
              value={draft.priceDescoin} onChange={(e) => setDraft((d) => ({ ...d, priceDescoin: e.target.value }))} />
            {draft.category === "theme" && (
              <select
                className="admin-select"
                value={draft.themeKey}
                onChange={(e) => setDraft((d) => ({ ...d, themeKey: e.target.value }))}
                required
              >
                <option value="">{t("Select a theme key…")}</option>
                <option value="midnight">Midnight</option>
                <option value="crimson">Crimson</option>
                <option value="ocean">Ocean</option>
              </select>
            )}
            <input className="admin-input admin-shop-gift-field-wide" placeholder={t("Image / SVG data URL")}
              value={draft.assetUrl} onChange={(e) => setDraft((d) => ({ ...d, assetUrl: e.target.value }))} required />
            <textarea className="admin-textarea admin-shop-gift-field-wide" rows={2} placeholder={t("Description (optional)")}
              value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <RippleButton type="submit" className="admin-btn-green" disabled={creating}>
              {creating ? t("Creating…") : t("Create item")}
            </RippleButton>
            <button type="button" className="admin-btn-red" onClick={() => setShowCreateForm(false)}>
              {t("Cancel")}
            </button>
          </div>
        </motion.form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>{t("Name")}</th>
              <th>{t("Category")}</th>
              <th>{t("Price")}</th>
              <th>{t("Rarity")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 28 }}>{t("Loading…")}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "rgba(244,246,251,0.45)" }}>{t("No items yet.")}</td></tr>
            ) : (
              items.map((item) => (
                <motion.tr key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td>
                    {item.category === "theme" ? (
                      <div className={`shop-theme-swatch theme-${item.theme_key || "default"}`} style={{ width: 40, height: 28, borderRadius: 6 }} />
                    ) : (
                      <img src={item.preview_url || item.asset_url} alt="" style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 6 }} />
                    )}
                  </td>
                  <td>
                    {item.name}
                    {item.category === "theme" && (
                      <span className="mono" style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>
                        <Sparkles size={11} style={{ verticalAlign: "-1px" }} /> {item.theme_key}
                      </span>
                    )}
                  </td>
                  <td>{CATEGORIES.find((c) => c.id === item.category)?.label || item.category}</td>
                  <td>{formatDescoin(item.price_descoin)}</td>
                  <td className="mono">{item.rarity}</td>
                  <td className="admin-status">
                    {item.active ? (
                      <span className="admin-badge online"><CheckCircle2 size={12} /> {t("Active")}</span>
                    ) : (
                      <span className="admin-badge-false">{t("Inactive")}</span>
                    )}
                  </td>
                  <td className="admin-actions">
                    <button type="button" className={item.active ? "admin-btn-red" : "admin-btn-green"} onClick={() => toggleActive(item)}>
                      {item.active ? t("Deactivate") : t("Activate")}
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
