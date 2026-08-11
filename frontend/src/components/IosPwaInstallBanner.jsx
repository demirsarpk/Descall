import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import "./IosPwaInstallBanner.css";

const DISMISSED_KEY = "descall:ios-pwa-install-dismissed";

export function isIosSafari({ userAgent = "", maxTouchPoints = 0, standalone = false, displayMode = false } = {}) {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/i.test(userAgent);
  return ios && safari && !standalone && !displayMode;
}

export default function IosPwaInstallBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone = window.navigator.standalone === true;
    const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches;
    const eligible = isIosSafari({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone,
      displayMode,
    });
    if (eligible && !localStorage.getItem(DISMISSED_KEY)) setOpen(true);
    const reopen = () => eligible && setOpen(true);
    window.addEventListener("descall:open-ios-install", reopen);
    return () => window.removeEventListener("descall:open-ios-install", reopen);
  }, []);

  if (!open) return null;
  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  };
  return <aside className="ios-pwa-banner" role="dialog" aria-label="Install Descall">
    <div className="ios-pwa-banner__icon"><Share size={18} /></div>
    <div className="ios-pwa-banner__body">
      <strong>Descall’ı Ana Ekrana Ekle</strong>
      <span>Safari’de <b>Paylaş (□↑)</b> → <b>“Ana Ekrana Ekle”</b> → <b>“Ekle”</b> seç.</span>
    </div>
    <button className="ios-pwa-banner__close" onClick={dismiss} aria-label="Kapat"><X size={18} /></button>
  </aside>;
}
