import apiClient from "./axios";

export const getDashboard = async () => {
  const { data } = await apiClient.get("/api/company/dashboard");
  return data;
};
