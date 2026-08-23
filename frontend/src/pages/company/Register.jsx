import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, Sparkles, UserPlus } from "lucide-react";
import Navbar from "../../components/Navbar";
import { Field, inputClasses } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CompanyRegister = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Organization name is required";

    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }

    if (!form.password) {
      next.password = "Password is required";
    } else if (form.password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }

    if (form.confirmPassword !== form.password) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success("Organization created!");
      navigate("/company/onboarding", { replace: true });
    } catch (error) {
      const message = error.response?.data?.error || "Could not create your organization";
      toast.error(message);
      setErrors({ email: message });
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
          Create Organization
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-2 text-center text-slate-500"
        >
          Set up your organization account to start building your AI agent.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full space-y-5 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8"
        >
          <Field label="Organization Name" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={updateField("name")}
              placeholder="e.g. ABC Technologies"
              className={inputClasses(errors.name)}
              autoComplete="organization"
            />
          </Field>

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
                placeholder="Create a password"
                className={`${inputClasses(errors.password)} pr-10`}
                autoComplete="new-password"
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

          <Field label="Confirm Password" error={errors.confirmPassword}>
            <input
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={updateField("confirmPassword")}
              placeholder="Re-enter your password"
              className={inputClasses(errors.confirmPassword)}
              autoComplete="new-password"
            />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? "Creating organization…" : "Create Organization"}
          </button>
        </motion.form>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/company/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Log In
          </Link>
        </p>

        <Link to="/" className="mt-8 text-sm text-slate-400 hover:text-slate-600">
          Back to Home
        </Link>
      </main>
    </div>
  );
};

export default CompanyRegister;
