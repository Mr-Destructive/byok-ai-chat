
import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Sidebar } from "@/components/layout/Sidebar";
import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager";
import { AuthModal } from "@/components/auth/AuthModal";
import { SidebarProvider } from "@/components/ui/sidebar";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState<'chat' | 'api-keys'>('chat');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const API_BASE_URL = "http://localhost:8001";

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (token: string, user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentThreadId(undefined);
  };

  const handleNewChat = () => {
    setCurrentThreadId(undefined);
    setActiveView('chat');
  };

  const handleThreadSelect = (threadId: string) => {
    setCurrentThreadId(threadId);
    setActiveView('chat');
  };

  const handleThreadCreated = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <Sidebar 
          activeView={activeView}
          onViewChange={setActiveView}
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          onModelChange={setSelectedModel}
          onProviderChange={setSelectedProvider}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onLogout={handleLogout}
          currentUser={currentUser}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'chat' ? (
            <ChatInterface 
              selectedModel={selectedModel}
              selectedProvider={selectedProvider}
              currentThreadId={currentThreadId}
              onThreadCreated={handleThreadCreated}
              onModelChange={setSelectedModel}
              onProviderChange={setSelectedProvider}
            />
          ) : (
            <ApiKeyManager />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
