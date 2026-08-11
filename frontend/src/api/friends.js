import { authedRequest } from "./authedHttp";

export const blockUser = (userId) => authedRequest("/api/friends/block", { method: "POST", body: { userId } });
export const unblockUser = (userId) => authedRequest("/api/friends/unblock", { method: "POST", body: { userId } });
export const getBlockedUsers = () => authedRequest("/api/friends/blocked");
export const getFriendSuggestions = (limit = 12) =>
  authedRequest(`/api/friends/suggestions?limit=${limit}`);

/** REST bootstrap for chats/friends sidebar when socket friend:list is delayed. */
export const getFriendsList = () => authedRequest("/api/friends/list");
export const getFriendRequestsList = () => authedRequest("/api/friends/requests");
