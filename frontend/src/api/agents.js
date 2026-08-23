import apiClient from "./axios";

export const createAgent = async (payload) => {
  const { data } = await apiClient.post("/api/agents", payload);
  return data;
};

export const listAgents = async () => {
  const { data } = await apiClient.get("/api/agents");
  return data;
};

export const updateAgent = async (agentId, payload) => {
  const { data } = await apiClient.patch(`/api/agents/${agentId}`, payload);
  return data;
};

export const listPublicAgents = async () => {
  const { data } = await apiClient.get("/api/agents/public");
  return data;
};

export const getPublicAgent = async (agentId) => {
  const { data } = await apiClient.get(`/api/agents/public/${agentId}`);
  return data;
};
