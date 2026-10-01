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

export const heartbeatConversation = async (conversationId) => {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/heartbeat`);
  return data;
};

// Fire-and-forget variant for tab-close/navigation-away — a normal fetch/XHR
// gets cancelled the instant the page unloads, but sendBeacon is guaranteed
// by the browser to still deliver the request. Used so a user who just
// closes the tab doesn't leave the conversation stuck "active" forever.
export const endConversationBeacon = (conversationId) => {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  const base = apiClient.defaults.baseURL;
  return navigator.sendBeacon(`${base}/api/conversations/${conversationId}/end`);
};

export const listConversations = async () => {
  const { data } = await apiClient.get("/api/conversations");
  return data;
};

export const getConversation = async (conversationId) => {
  const { data } = await apiClient.get(`/api/conversations/${conversationId}`);
  return data;
};
