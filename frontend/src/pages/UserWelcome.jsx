import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowLeft, Bot, Building2, MessageSquare, Sparkles, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import { listPublicAgents } from "../api/agents";

const UserWelcome = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { agents: list } = await listPublicAgents();
        setAgents(list);
      } catch {
        toast.error("Failed to load agents");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-sm text-slate-600 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
            User Access
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight sm:text-5xl"
          >
            Welcome to CALL.E
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-5 max-w-lg text-lg text-slate-500"
          >
            Explore AI knowledge agents created by organizations and chat
            with them to get answers from their knowledge base.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14"
        >
          {isLoading ? (
            <p className="text-center text-sm text-slate-500">Loading agents&hellip;</p>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-8 py-16 text-center">
              <Users className="h-7 w-7 text-slate-400" />
              <p className="max-w-sm text-slate-500">
                No AI agents are available yet. Check back once an
                organization has set one up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => navigate(`/user/agent/${agent.id}`)}
                  className="w-full rounded-2xl border border-slate-200 bg-white/70 p-5 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-indigo-200 hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
                      <Bot className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{agent.name}</p>
                      <p className="truncate text-sm text-slate-500">{agent.role}</p>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{agent.objective}</p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="h-3.5 w-3.5" />
                      {agent.company_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Chat with Agent
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <div className="mt-14 flex justify-center">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
};

export default UserWelcome;
