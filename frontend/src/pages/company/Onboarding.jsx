/* eslint-disable react/prop-types -- internal-only presentational helper below, not part of the public API */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Bot,
  Building2,
  BookOpen,
  UploadCloud,
  FileText,
  X,
  Sparkles,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import { Field, inputClasses } from "../../components/FormField";
import { createAgent } from "../../api/agents";
import { uploadDocuments } from "../../api/documents";
import { notifyUploadResult } from "../../utils/notifyUploadResult";

const SECTIONS = [
  { key: "agent", label: "Agent Information", icon: Bot },
  { key: "organization", label: "Organization Information", icon: Building2 },
  { key: "knowledge", label: "Knowledge Base", icon: BookOpen },
];

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SectionCard = ({ icon: Icon, index, title, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.4 }}
    className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8"
  >
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-cyan-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Section {index}
        </p>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </motion.div>
);

const EMPTY_FORM = {
  agentName: "",
  agentRole: "",
  agentObjective: "",
  orgValues: "",
  conversationPurpose: "",
};

const CompanyOnboarding = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList);
    const nonPdf = incoming.filter(
      (f) => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")
    );

    if (nonPdf.length > 0) {
      setFileError(`Only PDF files are allowed: ${nonPdf.map((f) => f.name).join(", ")}`);
      toast.error("Only PDF files are allowed");
    } else {
      setFileError("");
    }

    const pdfs = incoming.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newOnes = pdfs.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...newOnes];
    });
  };

  const handleFileInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const next = {};
    if (!form.agentName.trim()) next.agentName = "Agent name is required";
    if (!form.agentRole.trim()) next.agentRole = "Agent role is required";
    if (!form.agentObjective.trim()) next.agentObjective = "Agent objective is required";
    if (!form.orgValues.trim()) next.orgValues = "Organization values are required";
    if (!form.conversationPurpose.trim()) next.conversationPurpose = "Conversation purpose is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { agent } = await createAgent({
        name: form.agentName.trim(),
        role: form.agentRole.trim(),
        objective: form.agentObjective.trim(),
        organization_values: form.orgValues.trim(),
        conversation_purpose: form.conversationPurpose.trim(),
      });

      toast.success("Agent created successfully!");

      if (files.length > 0) {
        const uploadResult = await uploadDocuments(agent.id, files);
        notifyUploadResult(uploadResult);
      }

      navigate("/company/dashboard", { replace: true });
    } catch (error) {
      const message = error.response?.data?.error || "Something went wrong creating your agent";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 flex items-center gap-2 text-sm text-slate-500"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
          Organization Onboarding
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl font-extrabold tracking-tight sm:text-4xl"
        >
          Create Your AI Agent
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-3 max-w-xl text-slate-500"
        >
          Provide information about your organization and upload documents
          so your AI agent can answer questions using your knowledge base.
        </motion.p>

        {/* Stepper */}
        <div className="mt-10 mb-10 flex items-center">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-2 sm:flex-row">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="hidden text-xs font-medium text-slate-600 sm:block">
                    {s.label}
                  </span>
                </div>
                {i < SECTIONS.length - 1 && (
                  <div className="mx-3 h-px flex-1 bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <SectionCard icon={Bot} index={1} title="Agent Information">
            <Field label="Agent Name" error={errors.agentName}>
              <input
                type="text"
                value={form.agentName}
                onChange={updateField("agentName")}
                placeholder="e.g. EduBot, CampusHelp, HR Assistant"
                className={inputClasses(errors.agentName)}
              />
            </Field>

            <Field label="Agent Role" error={errors.agentRole}>
              <input
                type="text"
                value={form.agentRole}
                onChange={updateField("agentRole")}
                placeholder="e.g. Education Department Assistant, College Helpdesk"
                className={inputClasses(errors.agentRole)}
              />
            </Field>

            <Field
              label="Agent Objective"
              error={errors.agentObjective}
              helper="Example: Answer student and citizen questions about admissions, scholarships, and departmental procedures using our official documents."
            >
              <textarea
                rows={3}
                value={form.agentObjective}
                onChange={updateField("agentObjective")}
                placeholder="What should this AI agent help people with?"
                className={inputClasses(errors.agentObjective)}
              />
            </Field>
          </SectionCard>

          <SectionCard icon={Building2} index={2} title="Organization Information">
            <Field
              label="Organization Information"
              error={errors.orgValues}
              helper="Example: Department of Education, State Government — responsible for school policy, scholarships, and curriculum guidelines."
            >
              <textarea
                rows={3}
                value={form.orgValues}
                onChange={updateField("orgValues")}
                placeholder="Describe your organization, department, or institution and what it does."
                className={inputClasses(errors.orgValues)}
              />
            </Field>

            <Field
              label="Agent Purpose"
              error={errors.conversationPurpose}
              helper="Example: Help users find accurate information from our official documents and clearly say when something isn't covered."
            >
              <textarea
                rows={3}
                value={form.conversationPurpose}
                onChange={updateField("conversationPurpose")}
                placeholder="What is the main purpose of chats with users?"
                className={inputClasses(errors.conversationPurpose)}
              />
            </Field>
          </SectionCard>

          <SectionCard icon={BookOpen} index={3} title="Knowledge Base">
            <div>
              <p className="mb-3 text-sm text-slate-500">
                Upload documents containing the information your AI agent
                should know &mdash; policies, guidelines, FAQs, product
                information, forms, brochures, or any other reference
                material.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  isDragging
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Drag & drop PDF files here, or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF files only &middot; multiple files supported
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {fileError && (
                <p className="mt-2 text-xs text-red-600">{fileError}</p>
              )}

              <AnimatePresence>
                {files.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 space-y-2"
                  >
                    {files.map((file, index) => (
                      <motion.li
                        key={`${file.name}-${file.size}-${index}`}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-4.5 w-4.5 shrink-0 text-indigo-500" />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-800">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </SectionCard>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating Agent…" : "Create AI Agent"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CompanyOnboarding;
