// API URL configuration
// Uses environment variable or falls back to production backend
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://descall-qzkg.onrender.com";

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
