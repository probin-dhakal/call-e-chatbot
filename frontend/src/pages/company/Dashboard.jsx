/* eslint-disable react/prop-types -- internal dashboard helpers */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Bot, FileText, MessagesSquare, UploadCloud, ArrowRight, PlusCircle,
  RefreshCw, Trash2, Power, CheckCircle2,
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
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  uploaded: "bg-amber-50 text-amber-700 ring-amber-100",
  processing: "bg-amber-50 text-amber-700 ring-amber-100",
  failed: "bg-red-50 text-red-700 ring-red-100",
};
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[status?.toLowerCase()] || STATUS_STYLES.completed}`}>
    {status}
  </span>
);
const Card = ({ icon: Icon, title, children, className = "", action }) => (
  <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm ${className}`}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100"><Icon className="h-4 w-4" /></span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </motion.section>
);

const CompanyDashboard = () => {
  const { company } = useAuth();
  const fileInputRef = useRef(null);
  const [data, setData] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isTogglingAgent, setIsTogglingAgent] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState(null);

  const loadDashboard = useCallback(async () => {
    try { setData(await getDashboard()); }
    catch { toast.error("Failed to load dashboard"); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    const agents = data?.agents || [];
    if (!agents.some((agent) => agent.id === selectedAgentId)) setSelectedAgentId(agents[0]?.id || null);
  }, [data, selectedAgentId]);

  const agents = data?.agents || [];
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const selectedDocuments = (data?.documents || []).filter((document) => document.agent_id === selectedAgentId);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !selectedAgent) return;
    if (files.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) {
      toast.error("Only PDF files are allowed");
      return;
    }
    setIsUploading(true);
    try {
      notifyUploadResult(await uploadDocuments(selectedAgent.id, files));
      await loadDashboard();
    } catch (error) { toast.error(error.response?.data?.error || "Upload failed"); }
    finally { setIsUploading(false); }
  };
  const handleToggleAgentActive = async () => {
    if (!selectedAgent) return;
    setIsTogglingAgent(true);
    try {
      await updateAgent(selectedAgent.id, { is_active: !selectedAgent.is_active });
      toast.success(selectedAgent.is_active ? "Agent deactivated" : "Agent activated");
      await loadDashboard();
    } catch (error) { toast.error(error.response?.data?.error || "Could not update agent status"); }
    finally { setIsTogglingAgent(false); }
  };
  const manageDocument = async (documentId, action) => {
    setBusyDocumentId(documentId);
    try {
      await action(documentId);
      toast.success(action === deleteDocument ? "Document removed" : "Document reprocessed");
      await loadDashboard();
    } catch (error) { toast.error(error.response?.data?.error || "Could not update document"); }
    finally { setBusyDocumentId(null); }
  };

  if (isLoading) return <div className="min-h-screen text-slate-900"><Navbar /><div className="flex justify-center py-24 text-slate-500">Loading dashboard&hellip;</div></div>;

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm text-slate-500">CALL.E Dashboard</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Welcome, {company?.name}</h1><p className="mt-2 text-sm text-slate-500">Create agents and add or maintain each agent&apos;s private knowledge base at any time.</p></div>
          <Link to="/company/onboarding" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:brightness-105"><PlusCircle className="h-4 w-4" />Create agent</Link>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card icon={Bot} title={`AI Agents (${agents.length})`} action={<Link to="/company/onboarding" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">+ New agent</Link>}>
            {agents.length ? <div className="space-y-2">{agents.map((agent) => {
              const selected = agent.id === selectedAgentId;
              const documentCount = (data?.documents || []).filter((doc) => doc.agent_id === agent.id).length;
              return <button key={agent.id} type="button" onClick={() => setSelectedAgentId(agent.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-600"><Bot className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{agent.name}</span><span className="block truncate text-xs text-slate-500">{agent.role} · {documentCount} document{documentCount === 1 ? "" : "s"}</span></span>
                {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />}
                <StatusBadge status={agent.is_active ? "Active" : "Inactive"} />
              </button>;
            })}</div> : <div className="text-sm text-slate-500">No agents yet. Create one to begin building a knowledge base.</div>}
          </Card>

          <Card icon={FileText} title={selectedAgent ? `${selectedAgent.name}'s Knowledge Base` : "Knowledge Base"}>
            {!selectedAgent ? <p className="text-sm text-slate-500">Select or create an agent before uploading documents.</p> : <>
              <div className="mb-4 flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-semibold text-slate-800">{selectedAgent.name}</p><p className="mt-0.5 text-slate-500">{selectedAgent.objective}</p></div><button onClick={handleToggleAgentActive} disabled={isTogglingAgent} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"><Power className="h-3 w-3" />{selectedAgent.is_active ? "Deactivate" : "Activate"}</button></div>
              {selectedDocuments.length ? <ul className="space-y-2">{selectedDocuments.map((doc) => <li key={doc.id} title={doc.status === "failed" ? doc.error_message : undefined} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><span className="min-w-0 truncate text-slate-700">{doc.original_filename}</span><span className="flex shrink-0 items-center gap-2"><span className="text-xs text-slate-400">{formatFileSize(doc.file_size)}</span><StatusBadge status={doc.status} />{doc.status === "failed" && <button onClick={() => manageDocument(doc.id, reprocessDocument)} disabled={busyDocumentId === doc.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-60" title="Reprocess"><RefreshCw className="h-3.5 w-3.5" /></button>}<button onClick={() => manageDocument(doc.id, deleteDocument)} disabled={busyDocumentId === doc.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button></span></li>)}</ul> : <p className="text-sm text-slate-500">No documents uploaded for this agent yet.</p>}
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"><UploadCloud className="h-4 w-4" />{isUploading ? "Processing and indexing…" : `Upload documents for ${selectedAgent.name}`}</button>
            </>}
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileChange} className="hidden" />
          </Card>
        </div>

        <Card icon={MessagesSquare} title="Conversations" className="mt-6">
          <div className="mb-4 flex items-center justify-between"><p className="text-sm text-slate-500">Total Conversations: <span className="font-semibold text-slate-900">{data?.conversation_count ?? 0}</span></p><Link to="/company/conversations" className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {data?.recent_conversations?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400"><th className="pb-2 font-medium">Conversation ID</th><th className="pb-2 font-medium">Agent</th><th className="pb-2 font-medium">Started</th><th className="pb-2 font-medium">Status</th></tr></thead><tbody>{data.recent_conversations.map((conversation) => <tr key={conversation.id} className="border-b border-slate-100 last:border-0"><td className="py-2.5 pr-4"><Link to={`/company/conversations/${conversation.id}`} className="font-mono text-xs text-indigo-600 hover:text-indigo-700">{conversation.id.slice(0, 8)}&hellip;</Link></td><td className="py-2.5 pr-4 text-slate-700">{conversation.agent_name}</td><td className="py-2.5 pr-4 text-slate-500">{formatDate(conversation.started_at)}</td><td className="py-2.5"><StatusBadge status={conversation.status} /></td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No conversations yet.</p>}
        </Card>
      </main>
    </div>
  );
};

export default CompanyDashboard;
