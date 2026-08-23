/* eslint-disable react/prop-types -- internal-only presentational helpers below, not part of the public API */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Bot,
  FileText,
  MessagesSquare,
  UploadCloud,
  ArrowRight,
  PlusCircle,
  RefreshCw,
  Trash2,
  Power,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";
import { getDashboard } from "../../api/company";
import { uploadDocuments, deleteDocument, reprocessDocument } from "../../api/documents";
import { updateAgent } from "../../api/agents";
import { notifyUploadResult } from "../../utils/notifyUploadResult";

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const STATUS_STYLES = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  uploaded: "bg-amber-50 text-amber-700 ring-amber-100",
  processing: "bg-amber-50 text-amber-700 ring-amber-100",
  failed: "bg-red-50 text-red-700 ring-red-100",
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
      STATUS_STYLES[status?.toLowerCase()] || STATUS_STYLES.completed
    }`}
  >
    {status}
  </span>
);

const Card = ({ icon: Icon, title, children, className = "" }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={`rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm ${className}`}
  >
    <div className="mb-5 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </motion.section>
);

const CompanyDashboard = () => {
  const { company } = useAuth();
  const fileInputRef = useRef(null);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isTogglingAgent, setIsTogglingAgent] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const result = await getDashboard();
      setData(result);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const primaryAgent = data?.agents?.[0];

  const handleUploadClick = () => {
    if (!primaryAgent) {
      toast.error("Create an agent first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;

    const nonPdf = selected.filter((f) => !f.name.toLowerCase().endsWith(".pdf"));
    if (nonPdf.length > 0) {
      toast.error("Only PDF files are allowed");
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadDocuments(primaryAgent.id, selected);
      notifyUploadResult(uploadResult);
      await loadDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleAgentActive = async () => {
    if (!primaryAgent) return;
    setIsTogglingAgent(true);
    try {
      await updateAgent(primaryAgent.id, { is_active: !primaryAgent.is_active });
      toast.success(primaryAgent.is_active ? "Agent deactivated" : "Agent activated");
      await loadDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not update agent status");
    } finally {
      setIsTogglingAgent(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    setBusyDocumentId(documentId);
    try {
      await deleteDocument(documentId);
      toast.success("Document removed");
      await loadDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not delete document");
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleReprocessDocument = async (documentId) => {
    setBusyDocumentId(documentId);
    try {
      await reprocessDocument(documentId);
      toast.success("Document reprocessed");
      await loadDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not reprocess document");
    } finally {
      setBusyDocumentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen text-slate-900">
        <Navbar />
        <div className="flex justify-center py-24 text-slate-500">Loading dashboard&hellip;</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-sm text-slate-500">CALL.E Dashboard</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            Welcome, {company?.name}
          </h1>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card icon={Bot} title="AI Agent">
            {primaryAgent ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Agent Name</span>
                  <span className="font-medium text-slate-900">{primaryAgent.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Role</span>
                  <span className="font-medium text-slate-900">{primaryAgent.role}</span>
                </div>
                <div>
                  <span className="text-slate-500">Objective</span>
                  <p className="mt-1 text-slate-700">{primaryAgent.objective}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Status</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={primaryAgent.is_active ? "Active" : "Inactive"} />
                    <button
                      onClick={handleToggleAgentActive}
                      disabled={isTogglingAgent}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Power className="h-3 w-3" />
                      {primaryAgent.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                No agent configured yet.{" "}
                <Link to="/company/onboarding" className="font-semibold text-indigo-600 hover:text-indigo-700">
                  Create one
                </Link>
              </div>
            )}
          </Card>

          <Card icon={FileText} title="Knowledge Base">
            {data?.documents?.length > 0 ? (
              <ul className="space-y-2">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
                    title={doc.status === "failed" ? doc.error_message : undefined}
                  >
                    <span className="min-w-0 truncate text-slate-700">{doc.original_filename}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate-400">{formatFileSize(doc.file_size)}</span>
                      <StatusBadge status={doc.status} />
                      {doc.status === "failed" && (
                        <button
                          onClick={() => handleReprocessDocument(doc.id)}
                          disabled={busyDocumentId === doc.id}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Reprocess ${doc.original_filename}`}
                          title="Reprocess"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={busyDocumentId === doc.id}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Delete ${doc.original_filename}`}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No documents uploaded yet.</p>
            )}

            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {isUploading ? "Uploading…" : "Upload Document"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </Card>
        </div>

        <Card icon={MessagesSquare} title="Conversations" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Total Conversations:{" "}
              <span className="font-semibold text-slate-900">{data?.conversation_count ?? 0}</span>
            </p>
            <Link
              to="/company/conversations"
              className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {data?.recent_conversations?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-2 font-medium">Conversation ID</th>
                    <th className="pb-2 font-medium">Agent</th>
                    <th className="pb-2 font-medium">Started</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Resolution Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_conversations.map((conv) => (
                    <tr key={conv.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link
                          to={`/company/conversations/${conv.id}`}
                          className="font-mono text-xs text-indigo-600 hover:text-indigo-700"
                        >
                          {conv.id.slice(0, 8)}&hellip;
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700">{conv.agent_name}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDate(conv.started_at)}</td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={conv.status} />
                      </td>
                      <td className="py-2.5 text-slate-500">{conv.lead_status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No conversations yet.</p>
          )}
        </Card>

        {!primaryAgent && (
          <Link
            to="/company/onboarding"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105"
          >
            <PlusCircle className="h-4 w-4" />
            Create Your AI Agent
          </Link>
        )}
      </main>
    </div>
  );
};

export default CompanyDashboard;
