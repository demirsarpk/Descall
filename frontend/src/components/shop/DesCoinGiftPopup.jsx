import { AnimatePresence, motion } from "framer-motion";
import { Coins, Sparkles, X } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { useT } from "../../context/LocaleContext";

/**
 * Full-screen celebratory popup shown when an admin grants a user DesCoin
 * with a message attached, e.g. via /api/admin/descoin/grant. Mirrors
 * ShopGiftPopup's shape so DesCoin grants feel like the same "gift" flow as
 * gifting a cosmetic item, just with a coin amount instead of an item card.
 */
export default function DesCoinGiftPopup({ gift, onDismiss }) {
  const t = useT();
  if (!gift) return null;
  const { amount, message, from } = gift;

  return (
    <AnimatePresence>
      <motion.div
        className="shop-gift-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="shop-gift-card descoin-gift-card"
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
        >
          <button className="shop-gift-close" onClick={onDismiss} aria-label={t("Close")}>
            <X size={18} />
          </button>

          <div className="shop-gift-icon descoin-gift-icon">
            <Coins size={28} />
            <Sparkles size={16} className="shop-gift-sparkle shop-gift-sparkle-1" />
            <Sparkles size={12} className="shop-gift-sparkle shop-gift-sparkle-2" />
          </div>

          <h3>{t("You received DesCoin!")}</h3>
          <p className="shop-gift-from">
            {t("{name} sent you", { name: from?.username || t("Descall staff") })}
          </p>

          <div className="descoin-gift-amount">
            <Coins size={22} />
            <span>+{Number(amount || 0).toLocaleString()}</span>
          </div>

          {message && <p className="shop-gift-message">“{message}”</p>}

          <div className="shop-gift-actions">
            <RippleButton className="btn-primary" onClick={onDismiss}>
              {t("Nice!")}
            </RippleButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
