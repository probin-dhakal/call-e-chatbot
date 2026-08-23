import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Compass,
  Building2,
  ArrowRight,
  Settings,
  BookOpen,
  Bot,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import Navbar from "../components/Navbar";

const steps = [
  {
    icon: Settings,
    title: "Configure",
    description: "Define your agent's name, role, and purpose.",
  },
  {
    icon: BookOpen,
    title: "Knowledge",
    description: "Upload your organization's documents and information.",
  },
  {
    icon: Bot,
    title: "AI Agent",
    description: "Your agent learns your knowledge base and its scope.",
  },
  {
    icon: MessageSquare,
    title: "Chat",
    description: "Users ask questions and get answers grounded in your knowledge.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" },
  }),
};

const FrontPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-24 text-center sm:pt-28">
        <motion.span
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-sm text-slate-600 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
          AI Knowledge Agents for Organizations
        </motion.span>

        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={1}
          className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl"
        >
          <span className="bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent">
            CALL
          </span>
          <span className="bg-gradient-to-br from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
            .E
          </span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={2}
          className="mt-4 text-xl font-medium text-slate-700 sm:text-2xl"
        >
          Create and Talk to AI Knowledge Agents
        </motion.p>

        <motion.p
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={3}
          className="mt-6 max-w-2xl text-balance text-base text-slate-500 sm:text-lg"
        >
          Organizations, institutions, and individuals create AI agents
          trained on their own documents and information. Anyone can chat
          with an agent to get answers grounded in that knowledge base.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={4}
          className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <button
            onClick={() => navigate("/user")}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
          >
            <Compass className="h-5 w-5 text-slate-500" />
            Explore AI Agents
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            onClick={() => navigate("/company/login")}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-105 sm:w-auto"
          >
            <Building2 className="h-5 w-5" />
            Create Your Agent
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            How CALL.E Works
          </h2>
          <p className="mt-2 text-slate-500">
            From setup to chat in four simple steps.
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="font-semibold text-slate-900">
                  {i + 1}. {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {step.description}
                </p>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 lg:block" />
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
        CALL.E &mdash; Create and Talk to AI Knowledge Agents
      </footer>
    </div>
  );
};

export default FrontPage;
