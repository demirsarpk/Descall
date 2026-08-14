import { useCallback, useEffect, useState } from "react";
import MarketingApp from "./MarketingApp";
import {
  login as apiLogin,
  register as apiRegister,
  verify2faLogin as apiVerify2fa,
  loginWithGoogle as apiGoogleLogin,
} from "../api/auth";
import { setToken, setUser } from "../lib/storage";

/**
 * Lightweight marketing shell — avoids importing the authenticated App/LiveKit tree
 * until the visitor actually signs in.
 */
export default function MarketingBoot() {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // Reveal the React shell and retire the static SEO copy (already painted for LCP).
    document.documentElement.setAttribute("data-react-ready", "1");
    const seo = document.getElementById("seo-static");
    if (seo) {
      seo.setAttribute("hidden", "");
      seo.setAttribute("aria-hidden", "true");
    }
    try {
      window.__descallDismissBootSplash?.({ minMs: 0 });
    } catch {
      /* ignore */
    }
  }, []);

  const enterApp = useCallback(() => {
    window.location.assign("/");
  }, []);

  const onLogin = useCallback(
    async ({ username, password }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await apiLogin({ username, password });
        if (res?.requires2fa || res?.pendingToken) return res;
        if (res?.token) setToken(res.token);
        if (res?.user) setUser(res.user);
        enterApp();
        return res;
      } catch (err) {
        setAuthError(err?.message || "Login failed");
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [enterApp]
  );

  const onRegister = useCallback(
    async (payload) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await apiRegister(payload);
        if (res?.token) setToken(res.token);
        if (res?.user) setUser(res.user);
        enterApp();
        return res;
      } catch (err) {
        setAuthError(err?.message || "Registration failed");
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [enterApp]
  );

  const onGoogleLogin = useCallback(
    async (credential) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await apiGoogleLogin(credential);
        if (res?.token) setToken(res.token);
        if (res?.user) setUser(res.user);
        enterApp();
        return res;
      } catch (err) {
        setAuthError(err?.message || "Google sign-in failed");
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [enterApp]
  );

  const onVerify2fa = useCallback(
    async (payload) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const pendingToken = payload?.pendingToken || payload?.token;
        const code = payload?.code || payload?.otp;
        const res = await apiVerify2fa(pendingToken, code);
        if (res?.token) setToken(res.token);
        if (res?.user) setUser(res.user);
        enterApp();
        return res;
      } catch (err) {
        setAuthError(err?.message || "2FA failed");
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [enterApp]
  );

  return (
    <MarketingApp
      onLogin={onLogin}
      onRegister={onRegister}
      onGoogleLogin={onGoogleLogin}
      onVerify2fa={onVerify2fa}
      authLoading={authLoading}
      authError={authError}
    />
  );
}
