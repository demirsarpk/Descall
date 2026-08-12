import { API_BASE_URL } from "../config/api";

export async function httpRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("API URL yapılandırılmamış. Lütfen yöneticinize başvurun.");
  }

  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let body = {};
    try {
      body = await response.json();
    } catch (parseError) {
      body = { error: "Sunucudan geçersiz yanıt alındı" };
    }

    if (!response.ok) {
      const err = new Error(body.error || body.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.code = body.code || null;
      err.ban = body.ban || null;
      err.body = body;
      throw err;
    }

    return body;
  } catch (networkError) {
    if (networkError?.code || networkError?.ban || networkError?.status) {
      throw networkError;
    }
    if (networkError.message?.includes('Failed to fetch') || networkError.message?.includes('NetworkError')) {
      throw new Error("Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.");
    }
    throw new Error(networkError.message || "Bağlantı hatası");
  }
}
