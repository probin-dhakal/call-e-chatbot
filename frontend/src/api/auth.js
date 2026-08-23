import apiClient from "./axios";

export const register = async ({ name, email, password }) => {
  const { data } = await apiClient.post("/api/auth/register", { name, email, password });
  return data;
};

export const login = async ({ email, password }) => {
  const { data } = await apiClient.post("/api/auth/login", { email, password });
  return data;
};

export const me = async () => {
  const { data } = await apiClient.get("/api/auth/me");
  return data;
};
