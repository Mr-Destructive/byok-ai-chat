import React, { useState, Component, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar, SidebarProvider } from "./components/layout/Sidebar";
import { ChatInterface } from "./components/chat/ChatInterface";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import { useAppContext } from "./context/AppContext";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TooltipProvider } from "@radix-ui/react-tooltip";

const queryClient = new QueryClient();

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-gray-100 rounded-md"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { useTheme } from "./context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

function MainApp() {
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();
  const { darkMode, toggleTheme } = useTheme();
  const { isAuthenticated } = useAppContext();

  // Protect all routes except /login and /register
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleThreadCreated = (threadId: string) => {
    setCurrentThreadId(threadId);
    console.log("Thread created:", threadId);
  };

  return (
    <div className="relative flex h-screen">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-8 z-50 flex items-center gap-2 bg-gray-900/80 rounded-full px-3 py-1 shadow border border-gray-800">
        <Sun className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-yellow-400'}`} />
        <Switch checked={darkMode} onCheckedChange={toggleTheme} />
        <Moon className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-gray-400'}`} />
      </div>
      <Sidebar onThreadCreated={handleThreadCreated} />
      <Routes>
        <Route
          path="/"
          element={
            <ChatInterface
              currentThreadId={currentThreadId}
              setCurrentThreadId={setCurrentThreadId}
              onThreadCreated={handleThreadCreated}
            />
          }
        />
        <Route path="/chat" element={<ChatInterface currentThreadId={currentThreadId} setCurrentThreadId={setCurrentThreadId} onThreadCreated={handleThreadCreated} />} />
        <Route path="/api-keys" element={<ApiKeysPage />} />
        {/* fallback to chat for any unknown route if authenticated */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  console.log("App mounted with QueryClientProvider and SidebarProvider");
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppProvider>
          <TooltipProvider>
            <SidebarProvider>
              <BrowserRouter>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/*" element={<MainApp />} />
                  </Routes>
                </ErrorBoundary>
              </BrowserRouter>
            </SidebarProvider>
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}