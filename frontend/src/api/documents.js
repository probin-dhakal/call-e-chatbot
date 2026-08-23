import apiClient from "./axios";

export const uploadDocuments = async (agentId, files) => {
  const formData = new FormData();
  formData.append("agent_id", agentId);
  files.forEach((file) => formData.append("files", file));

  const { data } = await apiClient.post("/api/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const listDocuments = async (agentId) => {
  const { data } = await apiClient.get("/api/documents", {
    params: agentId ? { agent_id: agentId } : {},
  });
  return data;
};

export const deleteDocument = async (documentId) => {
  const { data } = await apiClient.delete(`/api/documents/${documentId}`);
  return data;
};

export const reprocessDocument = async (documentId) => {
  const { data } = await apiClient.post(`/api/documents/${documentId}/reprocess`);
  return data;
};
