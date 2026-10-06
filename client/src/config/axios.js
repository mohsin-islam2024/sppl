import axios from "axios";
import { auth } from "./firebase.js";

/**
 * The single axios instance for the whole app.
 *
 * Two responsibilities:
 *   1. Attach the current Firebase ID token to every request.
 *   2. Unwrap the API's response envelope so callers get `data` directly.
 *
 * Token handling uses `getIdToken()` (not a cached copy) — the SDK refreshes an
 * expired token automatically, which is what keeps a long admin session working
 * without a manual re-login.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    try {
      // `false` returns the cached token when it is still valid, and refreshes it
      // once it is close to expiry.
      const token = await user.getIdToken(false);
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // A failed token fetch is not fatal here; the request goes out unauthenticated
      // and the API answers 401, which the response interceptor turns into an event.
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;

    // A 401 on a call the user believed they were signed in for means the session
    // died mid-use; the auth layer listens for this and clears local state.
    if (status === 401) {
      window.dispatchEvent(new CustomEvent("sppl:unauthorized"));
    }

    // Normalise the message so every caller sees a readable string, whether the
    // failure came from our API, the network or a proxy.
    const message =
      payload?.message ??
      (error.code === "ECONNABORTED"
        ? "The request took too long. Please check your connection."
        : error.message) ??
      "Something went wrong";

    return Promise.reject(
      Object.assign(error, {
        message,
        status,
        details: payload?.details,
        fieldErrors: Array.isArray(payload?.details)
          ? payload.details
          : undefined,
      }),
    );
  },
);

export default api;
