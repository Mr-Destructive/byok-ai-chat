import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi } from "@/lib/api";

interface AppContextType {
  isAuthenticated: boolean;
  currentUser: any;
  selectedModel: string;
  selectedProvider: string;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentUser: (user: any) => void;
  setSelectedModel: (model: string) => void;
  setSelectedProvider: (provider: string) => void;
  handleLogout: () => void;
  handleAuthSuccess: (token: string, user: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("selectedModel") || "gpt-4"
  );
  const [selectedProvider, setSelectedProvider] = useState(
    localStorage.getItem("selectedProvider") || "openai"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const user = await authApi.getMe();
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("authToken");
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
    localStorage.setItem("selectedProvider", selectedProvider);
  }, [selectedModel, selectedProvider]);

  const handleAuthSuccess = (token: string, user: any) => {
    localStorage.setItem("authToken", token);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("selectedModel");
    localStorage.removeItem("selectedProvider");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedModel("gpt-4");
    setSelectedProvider("openai");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        selectedModel,
        selectedProvider,
        setIsAuthenticated,
        setCurrentUser,
        setSelectedModel,
        setSelectedProvider,
        handleLogout,
        handleAuthSuccess,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
