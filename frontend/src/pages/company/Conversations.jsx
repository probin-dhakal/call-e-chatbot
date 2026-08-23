/* eslint-disable react/prop-types -- internal-only presentational helper below, not part of the public API */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { MessagesSquare } from "lucide-react";
import Navbar from "../../components/Navbar";
import { listConversations } from "../../api/conversations";

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
    {status}
  </span>
);

const CompanyConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { conversations: list } = await listConversations();
        setConversations(list);
      } catch {
        toast.error("Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <MessagesSquare className="h-3.5 w-3.5 text-cyan-600" />
            Conversation History
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">All Conversations</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
        >
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading&hellip;</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-500">No conversations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-2 font-medium">Conversation ID</th>
                    <th className="pb-2 font-medium">Agent</th>
                    <th className="pb-2 font-medium">Started</th>
                    <th className="pb-2 font-medium">Ended</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Resolution Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conv) => (
                    <tr key={conv.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link
                          to={`/company/conversations/${conv.id}`}
                          className="font-mono text-xs text-indigo-600 hover:text-indigo-700"
                        >
                          {conv.id}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700">{conv.agent_name}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDate(conv.started_at)}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDate(conv.ended_at)}</td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={conv.status} />
                      </td>
                      <td className="py-2.5 text-slate-500">{conv.lead_status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <Link to="/company/dashboard" className="mt-8 inline-block text-sm text-slate-400 hover:text-slate-600">
          &larr; Back to Dashboard
        </Link>
      </main>
    </div>
  );
};

export default CompanyConversations;
