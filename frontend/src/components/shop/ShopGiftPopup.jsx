import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { equipShopItem } from "../../api/shop";
import { useT } from "../../context/LocaleContext";

const CATEGORY_LABEL = {
  banner: "Profile Banner",
  avatar_frame: "Avatar Frame",
  profile_background: "Profile Background",
  theme: "Premium Theme",
  profile_badge: "Profile Badge",
  profile_title: "Profile Title",
  name_effect: "Name Effect",
  avatar_effect: "Avatar Effect",
  chat_bubble: "Chat Bubble Skin",
  presence_flare: "Presence Flare",
  profile_aura: "Profile Aura",
  sound_pack: "Sound Pack",
  typing_flare: "Typing Flare",
  reaction_burst: "Reaction Burst",
  call_overlay: "Call Overlay",
};

/**
 * Full-screen celebratory popup shown when an admin gifts a user a shop
 * item, e.g. via /api/admin/shop/gift. Renders the gifted item's preview,
 * the sender, and their optional note, with a one-tap equip action.
 */
export default function ShopGiftPopup({ gift, onDismiss, onEquipped }) {
  const t = useT();
  const [equipping, setEquipping] = useState(false);
  const [equipped, setEquipped] = useState(false);

  if (!gift) return null;
  const { item, message, from } = gift;

  const handleEquip = async () => {
    if (!item?.id || !item?.category) return;
    setEquipping(true);
    try {
      await equipShopItem(item.category, item.id);
      setEquipped(true);
      onEquipped?.(item);
    } catch (_) {
      // best-effort — user can equip later from the Shop tab
    } finally {
      setEquipping(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="shop-gift-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="shop-gift-card"
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
        >
          <button className="shop-gift-close" onClick={onDismiss} aria-label={t("Close")}>
            <X size={18} />
          </button>

          <div className="shop-gift-icon">
            <Gift size={28} />
            <Sparkles size={16} className="shop-gift-sparkle shop-gift-sparkle-1" />
            <Sparkles size={12} className="shop-gift-sparkle shop-gift-sparkle-2" />
          </div>

          <h3>{t("You received a gift!")}</h3>
          <p className="shop-gift-from">
            {t("{name} sent you", { name: from?.username || t("Descall staff") })}
          </p>

          {item?.preview_url && (
            <div className={`shop-gift-preview shop-gift-preview-${item.category}`}>
              <img src={item.preview_url} alt={item.name} />
            </div>
          )}

          <div className="shop-gift-item-name">{item?.name}</div>
          <div className="shop-gift-item-category">{t(CATEGORY_LABEL[item?.category] || "Item")}</div>

          {message && <p className="shop-gift-message">“{message}”</p>}

          <div className="shop-gift-actions">
            <RippleButton
              className="btn-primary"
              onClick={handleEquip}
              disabled={equipping || equipped}
            >
              {equipped ? t("Equipped") : equipping ? t("Applying…") : t("Equip now")}
            </RippleButton>
            <button type="button" className="us-link-btn" onClick={onDismiss}>
              {t("Maybe later")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
