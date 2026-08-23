import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowLeft, Bot, Building2, MessageSquare } from "lucide-react";
import Navbar from "../components/Navbar";
import { getPublicAgent } from "../api/agents";
import { createConversation } from "../api/conversations";

const AgentDetail = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { agent: data } = await getPublicAgent(agentId);
        setAgent(data);
      } catch (err) {
        const message = err.response?.data?.error || "Agent not found";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [agentId]);

  const handleStartConversation = async () => {
    setIsStarting(true);
    try {
      const conversation = await createConversation(agent.id);
      navigate(`/user/conversation/${conversation.id}`, {
        state: {
          agentName: agent.name,
          agentRole: agent.role,
          companyName: agent.company_name,
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not start chat");
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link to="/user" className="text-sm text-slate-400 hover:text-slate-600">
          &larr; Back to Agents
        </Link>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading&hellip;</p>
        ) : error ? (
          <div className="mt-6 flex flex-col items-start gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => navigate("/user")}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Agents
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
                <Bot className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{agent.name}</h1>
                <p className="text-slate-500">{agent.role}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-4 w-4" />
              {agent.company_name}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                About this agent
              </h2>
              <p className="mt-2 leading-relaxed text-slate-700">{agent.objective}</p>
            </div>

            <button
              onClick={handleStartConversation}
              disabled={isStarting}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4" />
              {isStarting ? "Starting…" : "Start Chat"}
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default AgentDetail;
