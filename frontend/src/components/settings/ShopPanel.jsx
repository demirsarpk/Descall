import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Coins, Flame, Phone, Play, ShoppingBag, Sparkles, Volume2, Zap } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import {
  getShopCatalog,
  getShopInventory,
  purchaseShopItem,
  equipShopItem,
  getDesCoinDaily,
  claimDesCoinDaily,
} from "../../api/shop";
import { previewSoundPack } from "../../lib/audioManager";
import { preloadSoundPack } from "../../lib/soundPackSynth";
import { useT } from "../../context/LocaleContext";
import InviteCard from "../friends/InviteCard";

/** Short tab labels — same pattern as admin top nav. */
const CATEGORY_TABS = [
  { id: "banner", label: "Banners" },
  { id: "avatar_frame", label: "Frames" },
  { id: "profile_background", label: "Backgrounds" },
  { id: "theme", label: "Themes" },
  { id: "profile_badge", label: "Badges" },
  { id: "profile_title", label: "Titles" },
  { id: "name_effect", label: "Name Effects" },
  { id: "avatar_effect", label: "Avatar Effects" },
  { id: "chat_bubble", label: "Bubbles" },
  { id: "presence_flare", label: "Presence" },
  { id: "profile_aura", label: "Auras" },
  { id: "sound_pack", label: "Sounds" },
  { id: "typing_flare", label: "Typing" },
  { id: "reaction_burst", label: "Reactions" },
  { id: "call_overlay", label: "Call Overlays" },
];

const CATEGORY_HEADING = {
  banner: "Profile Banners",
  avatar_frame: "Avatar Frames",
  profile_background: "Profile Backgrounds",
  theme: "Premium Themes",
  profile_badge: "Profile Badges",
  profile_title: "Profile Titles",
  name_effect: "Name Effects",
  avatar_effect: "Avatar Effects",
  chat_bubble: "Chat Bubble Skins",
  presence_flare: "Presence Flares",
  profile_aura: "Profile Auras",
  sound_pack: "Sound Packs",
  typing_flare: "Typing Flares",
  reaction_burst: "Reaction Bursts",
  call_overlay: "Call Overlays",
};

function ShopItemPreview({ category, item, t }) {
  if (category === "theme") {
    return <div className={`shop-theme-swatch theme-${item.theme_key || "default"}`} />;
  }
  if (category === "profile_badge") {
    return <span className="shop-badge-preview">{item.badge_icon}</span>;
  }
  if (category === "profile_title") {
    return <span className="cosmetic-title-tag shop-title-preview">{item.title_text}</span>;
  }
  if (category === "name_effect") {
    return (
      <span className={`cosmetic-name-effect effect-${item.effect_key} shop-name-effect-preview`}>
        {item.name}
      </span>
    );
  }
  if (category === "avatar_effect") {
    return (
      <div className="shop-avatar-effect-preview">
        <div className={`cosmetic-avatar-effect effect-${item.effect_key}`} />
        <div className="shop-avatar-effect-dot" />
      </div>
    );
  }
  if (category === "chat_bubble") {
    return (
      <div className={`cosmetic-chat-bubble bubble-${item.effect_key} shop-bubble-preview`}>
        {t("Hey there!")}
      </div>
    );
  }
  if (category === "presence_flare") {
    return (
      <div className="shop-presence-flare-preview">
        <span className={`status-badge status-online cosmetic-presence-flare flare-${item.effect_key}`} />
      </div>
    );
  }
  if (category === "profile_aura") {
    return (
      <div className={`shop-profile-aura-preview cosmetic-profile-aura aura-${item.effect_key}`}>
        <Sparkles size={18} />
      </div>
    );
  }
  if (category === "sound_pack") {
    return (
      <button
        type="button"
        className="shop-sound-pack-preview"
        title={t("Preview sound")}
        onMouseEnter={() => {
          if (item.effect_key) preloadSoundPack(item.effect_key);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          previewSoundPack(item.effect_key);
        }}
      >
        <Volume2 size={22} />
        <span>{item.effect_key}</span>
        <span className="shop-sound-pack-play">
          <Play size={12} fill="currentColor" />
          {t("Preview")}
        </span>
      </button>
    );
  }
  if (category === "typing_flare") {
    return (
      <div className={`shop-typing-flare-preview cosmetic-typing-flare typing-${item.effect_key}`}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    );
  }
  if (category === "reaction_burst") {
    return (
      <div className={`shop-reaction-burst-preview cosmetic-reaction-burst burst-${item.effect_key}`}>
        <span>🔥</span>
        <Zap size={14} />
      </div>
    );
  }
  if (category === "call_overlay") {
    return (
      <div className={`shop-call-overlay-preview cosmetic-call-overlay overlay-${item.effect_key}`}>
        <Phone size={18} />
      </div>
    );
  }
  return <img src={item.preview_url || item.asset_url} alt={item.name} loading="lazy" />;
}

export default function ShopPanel({ equipped, onEquippedChange, balance = 0, me = null, onBalanceChange }) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [celebrateItemId, setCelebrateItemId] = useState(null);
  const [notice, setNotice] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [daily, setDaily] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    // Full loading flash unmounts the grid and resets .us-main-scroll to top.
    // Only show it on the first open — refresh after buy/equip stays silent.
    if (!silent) setLoading(true);
    try {
      const [{ items: catalog }, { inventory: inv }, dailyStatus] = await Promise.all([
        getShopCatalog(),
        getShopInventory(),
        getDesCoinDaily().catch(() => null),
      ]);
      setItems(catalog || []);
      setInventory(inv || []);
      if (dailyStatus) setDaily(dailyStatus);
    } catch (_) {
      // best-effort
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleDailyClaim = async () => {
    if (claiming || daily?.claimedToday) return;
    setClaiming(true);
    setNotice("");
    try {
      const result = await claimDesCoinDaily();
      setDaily(result);
      if (result?.balance != null) onBalanceChange?.(result.balance);
      if (result?.claimed) {
        setNotice(t("Daily DesCoin claimed! +{amount}", { amount: result.credited || 0 }));
      } else if (result?.alreadyClaimed) {
        setNotice(t("Already claimed today — come back tomorrow"));
      }
    } catch (err) {
      setNotice(err.message || t("Could not claim daily DesCoin"));
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const preserveShopScroll = useCallback(async (action) => {
    const scrollEl = document.querySelector(".us-main-scroll");
    const scrollTop = scrollEl?.scrollTop ?? 0;
    try {
      return await action();
    } finally {
      const restore = () => {
        if (scrollEl) scrollEl.scrollTop = scrollTop;
      };
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 0);
      setTimeout(restore, 50);
    }
  }, []);

  const ownedItemIds = useMemo(() => new Set(inventory.map((i) => i.itemId)), [inventory]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return map;
  }, [items]);

  const availableTabs = useMemo(
    () => CATEGORY_TABS.filter((tab) => countsByCategory.has(tab.id)),
    [countsByCategory]
  );

  useEffect(() => {
    if (!availableTabs.length) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !availableTabs.some((tab) => tab.id === activeCategory)) {
      setActiveCategory(availableTabs[0].id);
    }
  }, [availableTabs, activeCategory]);

  const visibleItems = useMemo(
    () => (activeCategory ? items.filter((item) => item.category === activeCategory) : []),
    [items, activeCategory]
  );

  const handleBuy = async (item) => {
    setBusyItemId(item.id);
    setNotice("");
    try {
      await preserveShopScroll(async () => {
        await purchaseShopItem(item.id);
        // Optimistic own so the card flips to Equip without a loading flash.
        setInventory((prev) =>
          prev.some((row) => row.itemId === item.id)
            ? prev
            : [...prev, { itemId: item.id, item }]
        );
        setCelebrateItemId(item.id);
        window.setTimeout(() => {
          setCelebrateItemId((id) => (id === item.id ? null : id));
        }, 1200);
        await load({ silent: true });
        await onEquippedChange?.(null, null);
      });
    } catch (err) {
      setNotice(err.message || t("Purchase failed. Please try again."));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquip = async (item, isEquipped) => {
    setBusyItemId(item.id);
    try {
      await preserveShopScroll(async () => {
        await equipShopItem(item.category, isEquipped ? null : item.id);
        await onEquippedChange?.(item.category, isEquipped ? null : item.id);
      });
    } catch (_) {
      // best-effort
    } finally {
      setBusyItemId(null);
    }
  };

  const equippedIdFor = (category) => {
    if (category === "banner") return equipped?.bannerId;
    if (category === "avatar_frame") return equipped?.avatarFrameId;
    if (category === "profile_background") return equipped?.backgroundId;
    if (category === "theme") return equipped?.themeId;
    if (category === "profile_badge") return equipped?.badgeId;
    if (category === "profile_title") return equipped?.titleId;
    if (category === "name_effect") return equipped?.nameEffectId;
    if (category === "avatar_effect") return equipped?.avatarEffectId;
    if (category === "chat_bubble") return equipped?.chatBubbleId;
    if (category === "presence_flare") return equipped?.presenceFlareId;
    if (category === "profile_aura") return equipped?.profileAuraId;
    if (category === "sound_pack") return equipped?.soundPackId;
    if (category === "typing_flare") return equipped?.typingFlareId;
    if (category === "reaction_burst") return equipped?.reactionBurstId;
    if (category === "call_overlay") return equipped?.callOverlayId;
    return null;
  };

  return (
    <motion.div className="shop-panel" initial={false} animate={{ opacity: 1, y: 0 }}>
      <div className="shop-panel-header-row">
        <h3>
          <ShoppingBag size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {t("Shop")}
        </h3>
        <div className="shop-wallet-pill" title={t("Your DesCoin balance")}>
          <Coins size={16} />
          <span>{balance.toLocaleString()}</span>
          <span className="shop-wallet-label">DesCoin</span>
        </div>
      </div>
      <p className="shop-panel-intro">
        {t("Earn DesCoin by talking in calls, messaging, and sharing your screen — then spend it on banners, frames, auras, flares, sound packs, and more.")}
      </p>

      <div className="descoin-retention-row">
        <div className="descoin-daily-card">
          <div className="descoin-daily-head">
            <Flame size={18} />
            <div>
              <strong>{t("Daily reward")}</strong>
              <span>
                {t("Streak")}: {daily?.streak ?? 0}
                {daily?.claimedToday ? ` · ${t("Claimed")}` : ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="descoin-daily-claim"
            disabled={claiming || Boolean(daily?.claimedToday)}
            onClick={handleDailyClaim}
          >
            <Coins size={15} />
            {daily?.claimedToday
              ? t("Come back tomorrow")
              : t("Claim {amount} DesCoin", { amount: daily?.claimAmount || 40 })}
          </button>
          {daily?.goals && (
            <div className="descoin-goals">
              <div className="descoin-goal">
                <span>{t("Talk")}</span>
                <b>{daily.goals.voice.earned}/{daily.goals.voice.cap}</b>
              </div>
              <div className="descoin-goal">
                <span>{t("Messages")}</span>
                <b>{daily.goals.message.earned}/{daily.goals.message.cap}</b>
              </div>
              <div className="descoin-goal">
                <span>{t("Screenshare")}</span>
                <b>{daily.goals.screenshare.earned}/{daily.goals.screenshare.cap}</b>
              </div>
            </div>
          )}
        </div>
        {me?.username && <InviteCard username={me.username} compact />}
      </div>

      {notice && <p className="us-inline-notice" style={{ margin: "-6px 0 4px" }}>{notice}</p>}

      {loading ? (
        <p className="us-muted">{t("Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="shop-empty-state">{t("No items available yet — check back soon!")}</p>
      ) : (
        <>
          <nav className="shop-category-tabs" aria-label={t("Shop categories")}>
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`shop-category-tab ${activeCategory === tab.id ? "active" : ""}`}
                onClick={() => setActiveCategory(tab.id)}
              >
                {t(tab.label)}
                <span className="shop-category-tab-count">{countsByCategory.get(tab.id) || 0}</span>
              </button>
            ))}
          </nav>

          <div className="shop-category-block">
            <h4>{t(CATEGORY_HEADING[activeCategory] || activeCategory)}</h4>
            <div className="shop-grid">
              {visibleItems.map((item) => {
                const category = item.category;
                const owned = ownedItemIds.has(item.id);
                const isEquipped = equippedIdFor(category) === item.id;
                const busy = busyItemId === item.id;
                const affordable = balance >= (item.price_descoin || 0);
                return (
                  <div
                    className={`shop-item-card${celebrateItemId === item.id ? " is-celebrating" : ""}`}
                    data-category={category}
                    key={item.id}
                  >
                    {celebrateItemId === item.id && (
                      <div className="shop-celebrate-banner">{t("Purchased — equip it anytime")}</div>
                    )}
                    <div
                      className="shop-item-preview"
                      data-theme-preview={category === "theme" ? item.theme_key : undefined}
                    >
                      <ShopItemPreview category={category} item={item} t={t} />
                    </div>
                    <div className="shop-item-body">
                      <div className="shop-item-name-row">
                        <span className="shop-item-name">{item.name}</span>
                        {item.rarity && (
                          <span className={`shop-rarity-badge shop-rarity-${item.rarity}`}>{item.rarity}</span>
                        )}
                      </div>
                      {item.description && <p className="shop-item-desc">{item.description}</p>}
                      <div className="shop-item-footer">
                        {owned ? (
                          <span className="shop-item-owned-pill">
                            <CheckCircle2 size={13} /> {t("Owned")}
                          </span>
                        ) : (
                          <span className="shop-item-price">
                            <Coins size={13} /> {(item.price_descoin || 0).toLocaleString()}
                          </span>
                        )}
                        {owned ? (
                          <RippleButton
                            className={isEquipped ? "btn-secondary sm" : "btn-primary sm"}
                            onClick={() => handleEquip(item, isEquipped)}
                            disabled={busy}
                          >
                            {busy ? t("Applying…") : isEquipped ? t("Unequip") : t("Equip")}
                          </RippleButton>
                        ) : (
                          <RippleButton
                            className="btn-primary sm"
                            onClick={() => handleBuy(item)}
                            disabled={busy || !affordable}
                            title={!affordable ? t("Not enough DesCoin yet") : undefined}
                          >
                            {busy ? t("Buying…") : affordable ? t("Buy") : t("Not enough DesCoin")}
                          </RippleButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
