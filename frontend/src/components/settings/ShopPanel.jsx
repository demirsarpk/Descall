import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Coins, ShoppingBag } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { getShopCatalog, getShopInventory, purchaseShopItem, equipShopItem } from "../../api/shop";
import { useT } from "../../context/LocaleContext";

const CATEGORY_LABEL = {
  banner: "Profile Banners",
  avatar_frame: "Avatar Frames",
  profile_background: "Profile Backgrounds",
  theme: "Premium Themes",
  profile_badge: "Profile Badges",
  profile_title: "Profile Titles",
  name_effect: "Name Effects",
  avatar_effect: "Avatar Effects",
  chat_bubble: "Chat Bubble Skins",
};

const CATEGORY_ORDER = [
  "banner",
  "avatar_frame",
  "profile_background",
  "theme",
  "profile_badge",
  "profile_title",
  "name_effect",
  "avatar_effect",
  "chat_bubble",
];

export default function ShopPanel({ equipped, onEquippedChange, balance = 0 }) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ items: catalog }, { inventory: inv }] = await Promise.all([getShopCatalog(), getShopInventory()]);
      setItems(catalog || []);
      setInventory(inv || []);
    } catch (_) {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ownedItemIds = useMemo(() => new Set(inventory.map((i) => i.itemId)), [inventory]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    }
    return map;
  }, [items]);

  const handleBuy = async (item) => {
    setBusyItemId(item.id);
    setNotice("");
    try {
      await purchaseShopItem(item.id);
      await load();
      await onEquippedChange?.(null, null); // no-op signal to let parents re-sync equip state if needed
    } catch (err) {
      setNotice(err.message || t("Purchase failed. Please try again."));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquip = async (item, isEquipped) => {
    setBusyItemId(item.id);
    try {
      await equipShopItem(item.category, isEquipped ? null : item.id);
      await onEquippedChange?.(item.category, isEquipped ? null : item.id);
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
    return null;
  };

  return (
    <motion.div className="shop-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
        {t("Earn DesCoin by talking in calls, messaging, and sharing your screen — then spend it on banners, avatar frames, backgrounds, and premium themes.")}
      </p>

      {notice && <p className="us-inline-notice" style={{ margin: "-6px 0 4px" }}>{notice}</p>}

      {loading ? (
        <p className="us-muted">{t("Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="shop-empty-state">{t("No items available yet — check back soon!")}</p>
      ) : (
        CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((category) => (
          <div className="shop-category-block" key={category}>
            <h4>{t(CATEGORY_LABEL[category])}</h4>
            <div className="shop-grid">
              {grouped.get(category).map((item) => {
                const owned = ownedItemIds.has(item.id);
                const isEquipped = equippedIdFor(category) === item.id;
                const busy = busyItemId === item.id;
                const affordable = balance >= (item.price_descoin || 0);
                return (
                  <div className="shop-item-card" data-category={item.category} key={item.id}>
                    <div className="shop-item-preview" data-theme-preview={category === "theme" ? item.theme_key : undefined}>
                      {category === "theme" ? (
                        <div className={`shop-theme-swatch theme-${item.theme_key || "default"}`} />
                      ) : category === "profile_badge" ? (
                        <span className="shop-badge-preview">{item.badge_icon}</span>
                      ) : category === "profile_title" ? (
                        <span className="cosmetic-title-tag shop-title-preview">{item.title_text}</span>
                      ) : category === "name_effect" ? (
                        <span className={`cosmetic-name-effect effect-${item.effect_key} shop-name-effect-preview`}>
                          {item.name}
                        </span>
                      ) : category === "avatar_effect" ? (
                        <div className="shop-avatar-effect-preview">
                          <div className={`cosmetic-avatar-effect effect-${item.effect_key}`} />
                          <div className="shop-avatar-effect-dot" />
                        </div>
                      ) : category === "chat_bubble" ? (
                        <div className={`cosmetic-chat-bubble bubble-${item.effect_key} shop-bubble-preview`}>
                          {t("Hey there!")}
                        </div>
                      ) : (
                        <img src={item.preview_url || item.asset_url} alt={item.name} loading="lazy" />
                      )}
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
        ))
      )}
    </motion.div>
  );
}
