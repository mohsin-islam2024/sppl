import api from "../config/axios.js";

/**
 * Auth API surface.
 *
 * Login, registration and password reset all happen directly against the Firebase
 * SDK in the browser. The only calls that reach our own API are the ones Firebase
 * cannot do: mirroring the account into MongoDB and reading the role.
 */
export const authService = {
  /** Mirror the freshly logged-in Firebase account into MongoDB. Idempotent. */
  sync: async ({ name, photoUrl } = {}) => {
    const { data } = await api.post("/auth/sync", { name, photoUrl });
    return data.data;
  },

  /** The current mirrored account, including its role. */
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data.data;
  },

  endSession: async () => {
    const { data } = await api.delete("/auth/session");
    return data.data;
  },
};

export default authService;
