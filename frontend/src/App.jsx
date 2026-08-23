import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import FrontPage from "./pages/FrontPage";
import UserWelcome from "./pages/UserWelcome";
import AgentDetail from "./pages/AgentDetail";
import Conversation from "./pages/Conversation";

import CompanyLogin from "./pages/company/Login";
import CompanyRegister from "./pages/company/Register";
import CompanyOnboarding from "./pages/company/Onboarding";
import CompanyDashboard from "./pages/company/Dashboard";
import CompanyConversations from "./pages/company/Conversations";
import ConversationDetail from "./pages/company/ConversationDetail";

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<FrontPage />} />
          <Route path="/user" element={<UserWelcome />} />
          <Route path="/user/agent/:agentId" element={<AgentDetail />} />
          <Route path="/user/conversation/:conversationId" element={<Conversation />} />

          <Route path="/company" element={<Navigate to="/company/login" replace />} />
          <Route path="/company/login" element={<CompanyLogin />} />
          <Route path="/company/register" element={<CompanyRegister />} />
          <Route
            path="/company/onboarding"
            element={
              <ProtectedRoute>
                <CompanyOnboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/dashboard"
            element={
              <ProtectedRoute>
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/conversations"
            element={
              <ProtectedRoute>
                <CompanyConversations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/conversations/:conversationId"
            element={
              <ProtectedRoute>
                <ConversationDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
