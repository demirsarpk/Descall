import { authedRequest } from "./authedHttp";

// Email verification
export const setEmail = (email) => authedRequest("/api/auth/email/set", { method: "POST", body: { email } });
export const resendEmailCode = () => authedRequest("/api/auth/email/resend", { method: "POST" });
export const verifyEmailCode = (code) => authedRequest("/api/auth/email/verify", { method: "POST", body: { code } });

// Two-factor authentication
export const enable2fa = () => authedRequest("/api/auth/2fa/enable", { method: "POST" });
export const disable2fa = (password) => authedRequest("/api/auth/2fa/disable", { method: "POST", body: { password } });

// Session management
export const getSessions = () => authedRequest("/api/auth/sessions");
export const revokeSession = (sessionId) => authedRequest(`/api/auth/sessions/${sessionId}/revoke`, { method: "POST" });
export const revokeOtherSessions = () => authedRequest("/api/auth/sessions/revoke-others", { method: "POST" });
