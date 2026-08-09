import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { getShopCatalog, getShopInventory, startShopCheckout, equipShopItem } from "../../api/shop";
import { useT } from "../../context/LocaleContext";

const CATEGORY_LABEL = {
  banner: "Profile Banners",
  avatar_frame: "Avatar Frames",
  profile_background: "Profile Backgrounds",
};

const CATEGORY_ORDER = ["banner", "avatar_frame", "profile_background"];

function formatPrice(cents, currency) {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(
      amount
    );
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function ShopPanel({ equipped, onEquippedChange }) {
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
      const { url } = await startShopCheckout(item.id);
      if (url) window.location.href = url;
    } catch (err) {
      setNotice(err.message || t("Payments are not configured yet. Please try again later."));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquip = async (item, isEquipped) => {
    setBusyItemId(item.id);
    try {
      await equipShopItem(item.category, isEquipped ? null : item.id);
      onEquippedChange?.(item.category, isEquipped ? null : item.id);
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
    return null;
  };

  return (
    <motion.div className="shop-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h3>
        <ShoppingBag size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
        {t("Shop")}
      </h3>
      <p className="shop-panel-intro">
        {t("Buy banners, avatar frames, and profile backgrounds to personalize how others see you.")}
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
                return (
                  <div className="shop-item-card" data-category={item.category} key={item.id}>
                    <div className="shop-item-preview">
                      <img src={item.preview_url || item.asset_url} alt={item.name} loading="lazy" />
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
                          <span className="shop-item-price">{formatPrice(item.price_cents, item.currency)}</span>
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
                          <RippleButton className="btn-primary sm" onClick={() => handleBuy(item)} disabled={busy}>
                            {busy ? t("Sending…") : t("Buy")}
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
