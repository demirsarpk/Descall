import { API_BASE_URL } from "../config/api";

export async function httpRequest(path, options = {}) {
  if (!API_BASE_URL || API_BASE_URL.includes("YOUR-RENDER-URL.onrender.com")) {
    throw new Error(
      "Frontend API URL missing. Create frontend/.env and set VITE_API_BASE_URL to your backend Render URL.",
    );
  }

  const url = `${API_BASE_URL}${path}`;
  const bodyText = options.body || '{}';
  

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
      body = { error: "Invalid response from server" };
    }


    if (!response.ok) {
      if (
        typeof body?.message === "string" &&
        body.message.toLowerCase().includes("no api key found")
      ) {
        throw new Error(
          "Wrong API base URL. VITE_API_BASE_URL must point to your Node backend (Render), not Supabase.",
        );
      }
      throw new Error(body.error || body.message || `HTTP ${response.status}`);
    }

    return body;
  } catch (networkError) {
    throw new Error(networkError.message || "Network error - check your connection");
  }
}
