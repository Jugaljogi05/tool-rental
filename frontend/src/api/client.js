import axios from "axios";

const defaultApiBaseUrl =
  typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("borrowly_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
