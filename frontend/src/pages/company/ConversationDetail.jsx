/* eslint-disable react/prop-types -- internal-only presentational helper below, not part of the public API */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ClipboardList, MessageCircle } from "lucide-react";
import Navbar from "../../components/Navbar";
import { getConversation } from "../../api/conversations";

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
    {status}
  </span>
);

const roleStyles = {
  user: "bg-white border-slate-200 text-slate-800",
  assistant: "bg-indigo-50 border-indigo-100 text-indigo-900",
  system: "bg-slate-100 border-slate-200 text-slate-500",
};

const ConversationDetail = () => {
  const { conversationId } = useParams();
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getConversation(conversationId);
        setConversation(data);
      } catch (err) {
        const message = err.response?.data?.error || "Conversation not found";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [conversationId]);

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/company/conversations" className="text-sm text-slate-400 hover:text-slate-600">
          &larr; Back to Conversations
        </Link>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading&hellip;</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
            >
              <p className="font-mono text-xs text-slate-400">{conversation.id}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-slate-500">
                  Agent: <span className="font-medium text-slate-900">{conversation.agent_name}</span>
                </span>
                <span className="text-slate-500">
                  Started: <span className="text-slate-700">{formatDate(conversation.started_at)}</span>
                </span>
                <span className="text-slate-500">
                  Ended: <span className="text-slate-700">{formatDate(conversation.ended_at)}</span>
                </span>
                <StatusBadge status={conversation.status} />
              </div>
            </motion.div>

            {conversation.summary && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900">Chat Summary</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Topic</p>
                    <p className="mt-1 text-slate-700">{conversation.summary.topic || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Key Points</p>
                    <p className="mt-1 text-slate-700">{conversation.summary.key_points || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Unresolved Questions</p>
                    <p className="mt-1 text-slate-700">{conversation.summary.unresolved_questions || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Follow-up</p>
                    <p className="mt-1 text-slate-700">{conversation.summary.next_action || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sentiment</p>
                    <p className="mt-1 text-slate-700 capitalize">{conversation.sentiment || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Resolution Status</p>
                    <p className="mt-1 text-slate-700 capitalize">{conversation.lead_status || "—"}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold text-slate-900">Transcript</h2>
              </div>

              {conversation.messages?.length > 0 ? (
                <ul className="space-y-3">
                  {conversation.messages.map((msg) => (
                    <li
                      key={msg.id}
                      className={`rounded-xl border px-4 py-3 text-sm ${roleStyles[msg.role] || roleStyles.system}`}
                    >
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">{msg.role}</p>
                      <p>{msg.content}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No messages in this conversation yet.</p>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
};

export default ConversationDetail;
