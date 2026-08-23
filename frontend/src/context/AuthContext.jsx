import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as authApi from "../api/auth";
import { getToken, setToken as persistToken, clearToken } from "../api/tokenStorage";

const COMPANY_KEY = "calle_company";
const AuthContext = createContext(null);

const readStoredCompany = () => {
  const raw = localStorage.getItem(COMPANY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// eslint-disable-next-line react/prop-types -- children is a standard React prop, not worth typing here
export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => getToken());
  const [company, setCompany] = useState(readStoredCompany);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { company: freshCompany } = await authApi.me();
        if (!cancelled) {
          setCompany(freshCompany);
          localStorage.setItem(COMPANY_KEY, JSON.stringify(freshCompany));
        }
      } catch {
        if (!cancelled) {
          clearToken();
          localStorage.removeItem(COMPANY_KEY);
          setTokenState(null);
          setCompany(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
    // Only run once on mount — token changes are handled by login/register/logout directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = (accessToken, companyData) => {
    persistToken(accessToken);
    localStorage.setItem(COMPANY_KEY, JSON.stringify(companyData));
    setTokenState(accessToken);
    setCompany(companyData);
  };

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    applySession(data.access_token, data.company);
    return data;
  }, []);

  const login = useCallback(async (payload) => {
    const data = await authApi.login(payload);
    applySession(data.access_token, data.company);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(COMPANY_KEY);
    setTokenState(null);
    setCompany(null);
  }, []);

  const value = {
    token,
    company,
    isAuthenticated: Boolean(token),
    isLoading,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs beside the provider it reads
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
