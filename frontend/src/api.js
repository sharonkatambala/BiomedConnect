import { supabase } from "./supabase.js";

function apiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "/api";
  }
  return "";
}

const API_BASE = apiBaseUrl();

export function isApiConfigured() {
  return Boolean(API_BASE);
}

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
  if (!API_BASE) {
    throw new Error(
      "API URL is not configured. Set VITE_API_BASE_URL in Vercel (or frontend/.env) to your backend, e.g. https://your-api.example.com/api"
    );
  }

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

  updateChat(chatId, title) {
    return request(`/chats/${chatId}`, {
      method: "PUT",
      body: JSON.stringify({ title })
    });
  },

  toggleStar(chatId) {
    return request(`/chats/${chatId}/star`, {
      method: "POST"
    });
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
  },

  getCommunityPosts(room) {
    return request(`/community/${room}`);
  },

  createCommunityPost(payload) {
    return request("/community/", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
