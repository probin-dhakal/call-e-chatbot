import { toast } from "react-hot-toast";

export const notifyUploadResult = ({ documents = [], rejected = [], duplicates = [] }) => {
  const completed = documents.filter((d) => d.status === "completed");
  const failed = documents.filter((d) => d.status === "failed");
  const totalChunks = completed.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  if (completed.length > 0) {
    toast.success(
      `Knowledge processed successfully. ${totalChunks} document ${totalChunks === 1 ? "chunk was" : "chunks were"} embedded and added to the agent's knowledge base.`
    );
  }

  failed.forEach((d) => {
    toast.error(`${d.original_filename}: ${d.error_message || "Processing failed"}`);
  });

  if (duplicates.length > 0) {
    toast(`Already in knowledge base: ${duplicates.join(", ")}`);
  }

  if (rejected.length > 0) {
    toast.error(`Only PDF files are allowed: ${rejected.join(", ")}`);
  }
};
