import { API_ROUTES } from "../config/api";
import { httpRequest } from "./http";

export function register(payload) {
  return httpRequest(API_ROUTES.register, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return httpRequest(API_ROUTES.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verify2faLogin(pendingToken, code) {
  return httpRequest("/auth/2fa/verify-login", {
    method: "POST",
    body: JSON.stringify({ pendingToken, code }),
  });
}

export function loginWithGoogle(credential, extra = {}) {
  const payload = { credential };
  if (extra?.invitedBy) payload.invitedBy = extra.invitedBy;
  if (extra?.termsAccepted) payload.termsAccepted = true;
  return httpRequest(API_ROUTES.google, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGoogleAuthConfig() {
  return httpRequest(API_ROUTES.googleConfig, {
    method: "GET",
  });
}

export function getMe(token) {
  return httpRequest(API_ROUTES.me, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}
