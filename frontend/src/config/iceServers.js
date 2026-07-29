const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Build ICE server list from env (VITE_TURN_* for TURN in production).
 */
export function getIceServers() {
  const servers = [...STUN_SERVERS];
  const turnUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_URL;
  const turnUser = typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_USERNAME;
  const turnCred = typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnCred,
    });
  }

  return servers;
}

export const ICE_SERVERS = getIceServers();
