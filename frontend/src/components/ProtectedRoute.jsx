import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// eslint-disable-next-line react/prop-types -- children is a standard React prop, not worth typing here
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading&hellip;
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/company/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
