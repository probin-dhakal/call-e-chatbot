import { Link, useNavigate } from "react-router-dom";
import { Bot, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { isAuthenticated, company, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#fdfbf3]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
            <Bot className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            CALL<span className="text-cyan-600">.</span>E
          </span>
        </Link>

        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {company?.name && (
              <span className="hidden text-sm text-slate-600 sm:block">
                {company.name}
              </span>
            )}
            <Link
              to="/company/dashboard"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
