import axios from "axios";

/** Must match the key used after login in App (localStorage). */
export const AUTH_TOKEN_KEY = "token";

export const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

apiClient.interceptors.request.use((config) => {
  const url = typeof config.url === "string" ? config.url : "";
  const isAuthRoute =
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.endsWith("/auth/login") ||
    url.endsWith("/auth/register");
  if (!isAuthRoute) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
