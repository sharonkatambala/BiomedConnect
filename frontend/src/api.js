import { supabase } from "./supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function buildHeaders(extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  if (supabase) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }

  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: await buildHeaders(options.headers)
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text ? { detail: text } : null;
  }

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

export const api = {
  getMe() {
    return request("/auth/me");
  },

  listChats() {
    return request("/chats");
  },

  getChat(chatId) {
    return request(`/chats/${chatId}`);
  },

  deleteChat(chatId) {
    return request(`/chats/${chatId}`, {
      method: "DELETE"
    });
  },

  sendMessage(payload) {
    return request("/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
