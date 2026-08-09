import { authedRequest } from "./authedHttp";

export const getShopCatalog = () => authedRequest("/api/shop/catalog");
export const getShopInventory = () => authedRequest("/api/shop/inventory");
export const startShopCheckout = (itemId) =>
  authedRequest("/api/shop/checkout", { method: "POST", body: { itemId } });
export const equipShopItem = (category, itemId) =>
  authedRequest("/api/shop/equip", { method: "POST", body: { category, itemId } });

// Admin-only
export const listAllShopItems = () => authedRequest("/api/admin/shop/items");
export const giftShopItem = (userId, itemId, message) =>
  authedRequest("/api/admin/shop/gift", { method: "POST", body: { userId, itemId, message } });
