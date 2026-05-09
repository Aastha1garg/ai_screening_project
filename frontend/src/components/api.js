import axios from "axios";

/** Must match the key used after login in App (localStorage). */
export const AUTH_TOKEN_KEY = "token";

export const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:8000",
});

apiClient.interceptors.request.use((config) => {
  const url = typeof config.url === "string" ? config.url : "";
  const isAuthRoute =
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.endsWith("/auth/login") ||
    url.endsWith("/auth/register");
  if (!isAuthRoute) {
    let token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      // Ensure we don't accidentally add 'Bearer ' multiple times
      token = token.replace(/^Bearer\s+/i, '');
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Dispatch a global event when a 401 is encountered
      window.dispatchEvent(new Event('auth-failure'));
    }
    return Promise.reject(error);
  }
);
