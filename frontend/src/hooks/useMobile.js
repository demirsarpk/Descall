import { useState, useEffect, useCallback } from "react";

function readIsMobile() {
  if (typeof window === "undefined") return false;
  const userAgent = (navigator.userAgent || "").toLowerCase();
  const isMobileDevice =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(
      userAgent
    );
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileDevice || isSmallScreen;
}

function readIsPortrait() {
  if (typeof window === "undefined") return true;
  return window.innerHeight > window.innerWidth;
}

function readTouchSupported() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function useMobile() {
  // Sync initial state so the first paint (e.g. User Settings open) already
  // knows we're on mobile — otherwise framer-motion skips enter animation.
  const [isMobile, setIsMobile] = useState(readIsMobile);
  const [isPortrait, setIsPortrait] = useState(readIsPortrait);
  const [touchSupported, setTouchSupported] = useState(readTouchSupported);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(readIsMobile());
      setIsPortrait(readIsPortrait());
      setTouchSupported(readTouchSupported());
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  const vibrate = useCallback((pattern = 50) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  return { isMobile, isPortrait, touchSupported, vibrate };
}
