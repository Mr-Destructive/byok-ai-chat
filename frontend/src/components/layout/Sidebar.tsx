import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent
} from '@/components/ui/dialog';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { Key } from 'lucide-react';
import { ApiKeyManager } from '@/components/api-keys/ApiKeyManager';
import { ChevronLeft, ChevronRight, LogOut, MessageSquare, Moon, Sun } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAppContext } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface SidebarContextType {
  selectedProvider: string;
  selectedModel: string;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ selectedProvider, setSelectedProvider, selectedModel, setSelectedModel }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

interface SidebarProps {
  onThreadCreated?: (threadId: string) => void;
}

export function Sidebar({ onThreadCreated }: SidebarProps) {
  const { selectedProvider, setSelectedProvider, selectedModel, setSelectedModel } = useSidebar();
  const { data, isLoading, error } = useQuery({
    queryKey: ["providers-and-models"],
    queryFn: chatApi.getProvidersAndModels,
  });
  const { currentUser, handleLogout } = useAppContext();
  const [localCollapsed, setLocalCollapsed] = useState(false);

  // Chat threads state
  const { data: threads = [], isLoading: isThreadsLoading } = useQuery({
    queryKey: ['threads'],
    queryFn: chatApi.getThreads
  });
  const [selectedThread, setSelectedThread] = useState(null);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  // Handle selecting a thread
  const navigate = useNavigate();

  const handleThreadSelect = (thread) => {
    setSelectedThread(thread);
    navigate(`/chat/${thread.id}`);
    if (onThreadCreated) onThreadCreated(thread.id);
  };

  const handleNewChat = async () => {
    if (!selectedProvider || !selectedModel) return;
    try {
      const thread = await chatApi.createThread({
        title: "New Chat",
        provider: selectedProvider,
        model_name: selectedModel,
      });
      setSelectedThread(thread);
      if (onThreadCreated) onThreadCreated(thread.id);
      navigate(`/chat/${thread.id}`);
      if (typeof window !== 'undefined' && window.location) {
        window.dispatchEvent(new Event('focus'));
      }
    } catch (err) {
      // TODO: Add toast or error handling
      console.error('Failed to create new chat thread', err);
    }
  };

  const handleApiKeys = () => {
    navigate('/api-keys');
  };


  useEffect(() => {
    if (data && !selectedProvider && !selectedModel && data.providers?.length > 0) {
      const firstProvider = data.providers[0].id;
      setSelectedProvider(firstProvider);
      localStorage.setItem('selectedProvider', firstProvider);
      const firstModel = data.models_by_provider[firstProvider]?.[0] || "";
      if (firstModel) {
        setSelectedModel(firstModel);
        localStorage.setItem('selectedModel', firstModel);
      }
    }
  }, [data, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel]);

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    localStorage.setItem('selectedProvider', providerId);
    const availableModels = data?.models_by_provider[providerId] || [];
    const model = availableModels.length > 0 ? availableModels[0] : "";
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem('selectedModel', value);
  };


  const handleCollapse = () => {
    setLocalCollapsed(!localCollapsed);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-sidebar/80">
        <span className="text-red-400 text-lg font-bold mb-2">Failed to load providers</span>
        <span className="text-sidebar-foreground/70 text-sm mb-4">{error.message}</span>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (isLoading || !data || !data.providers?.length) {
    return (
      <div className="flex flex-col h-full justify-center items-center bg-sidebar/80">
        <div className="animate-pulse flex flex-col gap-4 w-5/6">
          <div className="h-8 bg-sidebar-accent/40 rounded w-2/3 mx-auto" />
          <div className="h-10 bg-blue-600/50 rounded w-full" />
          <div className="h-10 bg-sidebar-accent/40 rounded w-full" />
          <div className="h-6 bg-sidebar-accent/30 rounded w-1/2 mx-auto" />
          <div className="h-32 bg-sidebar-accent/20 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={`relative flex flex-col h-full transition-all duration-300 bg-sidebar/70 backdrop-blur-lg shadow-xl border-r border-sidebar-border ${localCollapsed ? "w-16" : "w-72"}`}
        style={{ minWidth: localCollapsed ? '4rem' : '18rem' }}
      >
        {/* App Heading/Logo */}
        <div className={`sticky top-0 z-30 flex flex-col bg-sidebar/80 ${localCollapsed ? 'items-center pt-4' : 'px-4 pt-4'} pb-2`}>
          <div className="flex items-center w-full mb-4">
            <span className="font-bold text-2xl tracking-tight text-sidebar-foreground drop-shadow-lg transition-all duration-300 flex-1">BYOK Chat</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="ml-2 p-1 rounded-full hover:bg-sidebar-accent/60 transition-colors"
                  onClick={handleCollapse}
                  aria-label={localCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {localCollapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{localCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
            </Tooltip>
          </div>
          {/* New Chat Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`mb-2 flex items-center justify-center w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 shadow transition-all ${localCollapsed ? 'w-10 h-10 p-0 justify-center mx-auto' : ''}`}
                aria-label="New Chat"
                title="New Chat"
                onClick={handleNewChat}
              >
                <MessageSquare className="w-5 h-5" />
                {!localCollapsed && <span className="ml-2">New Chat</span>}
              </button>
            </TooltipTrigger>
            {localCollapsed && <TooltipContent>New Chat</TooltipContent>}
          </Tooltip>
          {/* API Key Button below New Chat, styled same as New Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleApiKeys}
                className={`mb-3 flex items-center justify-center w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 shadow transition-all ${localCollapsed ? 'w-10 h-10 p-0 justify-center mx-auto' : ''}`}
                aria-label="API Keys"
                title="API Keys"
              >
                <Key className="w-5 h-5" />
                {!localCollapsed && <span className="ml-2">API Keys</span>}
              </button>
            </TooltipTrigger>
            {localCollapsed && <TooltipContent>API Keys</TooltipContent>}
          </Tooltip>
        </div>
        {/* Main Content */}
        <div className={`flex flex-col flex-1 w-full transition-all duration-300 ${localCollapsed ? 'px-1' : 'px-4'}`}>
          {/* Settings */}
          {!localCollapsed && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-sidebar-foreground mb-2">Settings</h2>
              <div className="mb-1">
                <label className="text-xs font-semibold text-sidebar-foreground uppercase tracking-widest">Provider</label>
                <Select value={selectedProvider || ""} onValueChange={handleProviderChange} disabled={isLoading}>
                  <SelectTrigger className="bg-sidebar-accent/80 text-sidebar-foreground w-full rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-1">
                <label className="text-xs font-semibold text-sidebar-foreground uppercase tracking-widest">Model</label>
                <Select value={selectedModel || ""} onValueChange={handleModelChange} disabled={isLoading || !selectedProvider}>
                  <SelectTrigger className="bg-sidebar-accent/80 text-sidebar-foreground w-full rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoading ? (
                      <div className="flex items-center gap-2 p-2 text-sidebar-foreground text-sm"><span className="animate-spin">⏳</span> Loading models...</div>
                    ) : data.models_by_provider[selectedProvider]?.length ? (
                      data.models_by_provider[selectedProvider].map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 p-2 text-sidebar-foreground text-sm"><span>🚫</span> No models available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Chat history only when expanded */}
          {!localCollapsed && (
            <div className="flex-1 min-h-0 overflow-y-auto mt-2 mb-2">
              <ChatHistorySidebar threads={threads} isThreadsLoading={isThreadsLoading} selectedThread={selectedThread} handleThreadSelect={handleThreadSelect} />
            </div>
          )}
        </div>
        {/* User Info & Logout at bottom */}
        {!localCollapsed && currentUser && (
          <div className="sticky bottom-0 left-0 w-full bg-sidebar/90 border-t border-sidebar-border px-4 py-3 flex flex-col gap-2 z-20">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9">
                {currentUser.avatar_url ? (
                  <AvatarImage src={currentUser.avatar_url} alt={currentUser.name || currentUser.email} />
                ) : (
                  <AvatarFallback>{(currentUser.name || currentUser.email || '?').slice(0,2).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sidebar-foreground truncate">{currentUser.name || 'User'}</span>
                <span className="text-xs text-sidebar-foreground/70 truncate">{currentUser.email}</span>
              </div>
            </div>
            <Button variant="destructive" size="sm" className="w-full mt-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </Button>
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}