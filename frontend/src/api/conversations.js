import apiClient from "./axios";

export const createConversation = async (agentId) => {
  const { data } = await apiClient.post("/api/conversations", { agent_id: agentId });
  return data;
};

export const startConversation = async (conversationId) => {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/start`);
  return data;
};

export const sendMessage = async (conversationId, message) => {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/message`, { message });
  return data;
};

export const endConversation = async (conversationId) => {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/end`);
  return data;
};

export const listConversations = async () => {
  const { data } = await apiClient.get("/api/conversations");
  return data;
};

export const getConversation = async (conversationId) => {
  const { data } = await apiClient.get(`/api/conversations/${conversationId}`);
  return data;
};
