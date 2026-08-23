import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import Navbar from "../../components/Navbar";
import { Field, inputClasses } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { listAgents } from "../../api/agents";

const CompanyLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const next = {};
    if (!form.email.trim()) next.email = "Email is required";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      await login(form);
      toast.success("Welcome back!");

      const redirectTo = location.state?.from?.pathname;
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }

      // No specific destination requested — send new orgs to onboarding,
      // returning orgs straight to their dashboard.
      try {
        const { agents } = await listAgents();
        navigate(agents.length > 0 ? "/company/dashboard" : "/company/onboarding", { replace: true });
      } catch {
        navigate("/company/dashboard", { replace: true });
      }
    } catch (error) {
      const message = error.response?.data?.error || "Invalid email or password";
      toast.error(message);
      setErrors({ password: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-20">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-sm text-slate-600 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
          Organization Access
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl font-extrabold tracking-tight"
        >
          Organization Login
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-2 text-center text-slate-500"
        >
          Log in to manage your AI agent and conversations.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full space-y-5 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8"
        >
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={updateField("email")}
              placeholder="you@company.com"
              className={inputClasses(errors.email)}
              autoComplete="email"
            />
          </Field>

          <Field label="Password" error={errors.password}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={updateField("password")}
                placeholder="Your password"
                className={`${inputClasses(errors.password)} pr-10`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {isSubmitting ? "Logging in…" : "Log In"}
          </button>
        </motion.form>

        <p className="mt-6 text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/company/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Create Organization
          </Link>
        </p>

        <Link to="/" className="mt-8 text-sm text-slate-400 hover:text-slate-600">
          Back to Home
        </Link>
      </main>
    </div>
  );
};

export default CompanyLogin;
