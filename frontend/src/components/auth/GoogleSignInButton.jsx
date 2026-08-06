import { useEffect, useRef, useState } from "react";
import { getGoogleAuthConfig } from "../../api/auth";
import { useT } from "../../context/LocaleContext";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      if (window.google?.accounts?.id) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

/**
 * Renders Google Identity Services button.
 * onCredential(credentialJwt) is called after successful Google picker.
 */
export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const t = useT();
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [status, setStatus] = useState("loading"); // loading | ready | unavailable
  const [error, setError] = useState("");

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const envClientId =
          typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CLIENT_ID
            ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim()
            : "";

        let clientId = envClientId;
        if (!clientId) {
          const config = await getGoogleAuthConfig();
          clientId = config?.clientId || "";
        }

        if (!clientId) {
          if (!cancelled) setStatus("unavailable");
          return;
        }

        await loadGoogleScript();
        if (cancelled || !buttonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              callbackRef.current?.(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 280,
        });

        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("unavailable");
          setError(err.message || t("Google Sign-In unavailable"));
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "unavailable") {
    return (
      <p className="google-signin-hint" role="note">
        {error || t("Google Sign-In is not configured yet.")}
      </p>
    );
  }

  return (
    <div
      className={`google-signin-wrap${disabled ? " is-disabled" : ""}`}
      aria-busy={status === "loading"}
    >
      {status === "loading" && <p className="google-signin-hint">{t("Loading Google…")}</p>}
      <div ref={buttonRef} className="google-signin-button" />
    </div>
  );
}
