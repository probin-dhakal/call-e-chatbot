import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Bot,
  Send,
  Loader2,
  LogOut,
  ClipboardList,
  Home,
  User,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { startConversation, sendMessage, endConversation } from "../api/conversations";

// Reveal assistant replies a chunk at a time instead of dumping the whole
// response at once — the backend returns the full text in one shot, so this
// is a client-side typewriter animation, not real token streaming. Chunk
// size scales with message length so a long answer still finishes within
// MAX_STREAM_MS instead of crawling.
const CHAR_INTERVAL_MS = 15;
const MAX_STREAM_MS = 2200;

const Conversation = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const agentInfo = location.state || {};
  const agentName = agentInfo.agentName || "Agent";
  const agentRole = agentInfo.agentRole || "";
  const companyName = agentInfo.companyName || "the organization";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoadingGreeting, setIsLoadingGreeting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [endedData, setEndedData] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const streamIntervalRef = useRef(null);

  const clearStreamInterval = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  };

  const streamAssistantMessage = (fullText) => {
    return new Promise((resolve) => {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (!fullText) {
        resolve();
        return;
      }

      setIsStreaming(true);
      const totalTicks = Math.max(1, Math.ceil(MAX_STREAM_MS / CHAR_INTERVAL_MS));
      const chunkSize = Math.max(1, Math.ceil(fullText.length / totalTicks));
      let revealed = 0;

      clearStreamInterval();
      streamIntervalRef.current = setInterval(() => {
        revealed = Math.min(fullText.length, revealed + chunkSize);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: fullText.slice(0, revealed) };
          return next;
        });
        if (revealed >= fullText.length) {
          clearStreamInterval();
          setIsStreaming(false);
          resolve();
        }
      }, CHAR_INTERVAL_MS);
    });
  };

  useEffect(() => clearStreamInterval, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoadingGreeting(true);
      try {
        const data = await startConversation(conversationId);
        if (cancelled) return;
        setIsLoadingGreeting(false);
        await streamAssistantMessage(data.message);
      } catch (error) {
        if (cancelled) return;
        toast.error(error.response?.data?.error || "Could not start the chat.");
        setIsLoadingGreeting(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (!isLoadingGreeting && !isEnded && !isStreaming) {
      inputRef.current?.focus();
    }
  }, [isLoadingGreeting, isEnded, isStreaming]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || isStreaming || isEnded) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsSending(true);

    try {
      const data = await sendMessage(conversationId, text);
      setIsSending(false);
      await streamAssistantMessage(data.message);
    } catch (error) {
      toast.error(error.response?.data?.error || "Something went wrong. Please try again.");
      setIsSending(false);
    }
  };

  const handleEndChat = async () => {
    setIsEnded(true);
    try {
      const result = await endConversation(conversationId);
      setEndedData(result);
    } catch {
      // Best effort — still show the ended screen even if the summary fetch fails.
    }
  };

  const summary = endedData?.summary;

  if (isEnded) {
    return (
      <div className="min-h-screen text-slate-900">
        <Navbar />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col items-center justify-center px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8 text-center shadow-sm backdrop-blur-sm"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Bot className="h-8 w-8" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Chat Ended</h1>
              <p className="mt-2 text-slate-500">Thanks for chatting with {agentName}.</p>
            </div>

            <div className="flex w-full flex-col gap-3">
              <button
                onClick={() => setShowSummary((v) => !v)}
                disabled={!summary}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardList className="h-4 w-4" />
                {showSummary ? "Hide" : "View"} Chat Summary
              </button>

              <button
                onClick={() => navigate("/user")}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105"
              >
                <Home className="h-4 w-4" />
                Return Home
              </button>
            </div>

            <AnimatePresence>
              {showSummary && summary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden text-left"
                >
                  <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <SummaryRow label="Topic" value={summary.topic} />
                    <SummaryRow label="Key Points" value={summary.key_points} />
                    <SummaryRow label="Unresolved Questions" value={summary.unresolved_questions} />
                    <SummaryRow label="Resolution Status" value={endedData?.lead_status} />
                    <SummaryRow label="Follow-up" value={summary.follow_up} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col text-slate-900">
      <Navbar />

      {/* Agent header */}
      <div className="border-b border-slate-200 bg-white/70 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{agentName}</p>
              <p className="truncate text-xs text-slate-500">
                {agentRole ? `${agentRole} · ` : ""}
                {companyName}
              </p>
            </div>
          </div>

          <button
            onClick={handleEndChat}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            End Chat
          </button>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {isLoadingGreeting ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {agentName} is getting ready…
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                showCursor={isStreaming && i === messages.length - 1 && m.role === "assistant"}
              />
            ))
          )}

          {isSending && (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-slate-200 bg-white/70 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something…"
            disabled={isLoadingGreeting || isSending || isStreaming}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isLoadingGreeting || isSending || isStreaming || !input.trim()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

// eslint-disable-next-line react/prop-types -- internal-only presentational helper, not part of the public API
const MessageBubble = ({ role, content, showCursor }) => {
  const isUser = role === "user";
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-slate-200 text-slate-600" : "bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div
        className={`max-w-[75vw] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-md ${
          isUser ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {content}
        {showCursor && (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-slate-500 align-middle" />
        )}
      </div>
    </div>
  );
};

// eslint-disable-next-line react/prop-types -- internal-only presentational helper, not part of the public API
const SummaryRow = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-0.5 text-slate-700">{value || "—"}</p>
  </div>
);

export default Conversation;
