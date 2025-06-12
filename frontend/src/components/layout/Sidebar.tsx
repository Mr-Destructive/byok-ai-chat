
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Plus, 
  Key,
  Sparkles,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarProps {
  activeView: 'chat' | 'api-keys';
  onViewChange: (view: 'chat' | 'api-keys') => void;
  selectedModel: string;
  selectedProvider: string;
  onModelChange: (model: string) => void;
  onProviderChange: (provider: string) => void;
  onThreadSelect?: (threadId: string) => void;
  onNewChat?: () => void;
  onLogout?: () => void;
  currentUser?: any;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface Thread {
  id: string;
  title: string;
  provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

interface Provider {
  id: string;
  name: string;
}

const API_BASE_URL = "http://localhost:8001";

export function Sidebar({ 
  activeView, 
  onViewChange, 
  selectedModel, 
  selectedProvider,
  onModelChange,
  onProviderChange,
  onThreadSelect,
  onNewChat,
  onLogout,
  currentUser,
  collapsed,
  onToggleCollapse
}: SidebarProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(true);
  const { toast } = useToast();

  const getAuthToken = () => localStorage.getItem('authToken');

  useEffect(() => {
    loadProvidersAndModels();
  }, []);

  useEffect(() => {
    if (activeView === 'chat') {
      loadThreads();
    }
  }, [activeView]);

  const loadProvidersAndModels = async () => {
    setProvidersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/providers-and-models`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
        setModelsByProvider(data.models_by_provider);
        
        // Set default provider and model if none selected
        if (!selectedProvider && data.providers.length > 0) {
          const firstProvider = data.providers[0].id;
          onProviderChange(firstProvider);
          const firstModel = data.models_by_provider[firstProvider]?.[0];
          if (firstModel) {
            onModelChange(firstModel);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load providers and models:', error);
      toast({
        title: "Error",
        description: "Failed to load AI providers and models",
        variant: "destructive"
      });
    } finally {
      setProvidersLoading(false);
    }
  };

  const loadThreads = async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/threads`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const threadsData = await response.json();
        setThreads(threadsData);
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    onNewChat?.();
  };

  const handleThreadSelect = (threadId: string) => {
    onThreadSelect?.(threadId);
  };

  const handleProviderChange = (providerId: string) => {
    onProviderChange(providerId);
    const availableModels = modelsByProvider[providerId] || [];
    if (availableModels.length > 0) {
      onModelChange(availableModels[0]);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const currentProviderModels = modelsByProvider[selectedProvider] || [];

  if (collapsed) {
    return (
      <aside className="bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300 h-full w-16">
        {/* Header */}
        <div className="p-2 border-b border-slate-700/50 flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="text-slate-400 hover:text-white p-2 w-8 h-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-2">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 p-2 h-8"
            onClick={handleNewChat}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="p-2 flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-8 h-8 p-0",
              activeView === 'chat' 
                ? "bg-blue-600 text-white" 
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
            onClick={() => onViewChange('chat')}
          >
            <MessageSquare className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-8 h-8 p-0",
              activeView === 'api-keys' 
                ? "bg-blue-600 text-white" 
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
            onClick={() => onViewChange('api-keys')}
          >
            <Key className="w-3 h-3" />
          </Button>
        </div>

        {/* User Profile at bottom */}
        <div className="mt-auto p-2 border-t border-slate-700/50">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="bg-slate-700 text-slate-300 text-xs">
                    {currentUser?.email?.charAt(0).toUpperCase() || <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-800 border-slate-700" side="right" align="end">
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="text-white font-medium">{currentUser?.email}</p>
                  <p className="text-slate-400 text-xs">Signed in</p>
                </div>
                {onLogout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300 h-full w-80">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">BYOK Chat</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="text-slate-400 hover:text-white p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Navigation */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          <Button
            variant={activeView === 'chat' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "flex-1 text-xs",
              activeView === 'chat' 
                ? "bg-blue-600 text-white" 
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
            onClick={() => onViewChange('chat')}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Chats
          </Button>
          <Button
            variant={activeView === 'api-keys' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "flex-1 text-xs",
              activeView === 'api-keys' 
                ? "bg-blue-600 text-white" 
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
            onClick={() => onViewChange('api-keys')}
          >
            <Key className="w-3 h-3 mr-1" />
            API Keys
          </Button>
        </div>
      </div>

      {activeView === 'chat' && (
        <>
          {/* Model Selector */}
          <div className="p-4 border-b border-slate-700/50">
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              Model Selection
            </label>
            {providersLoading ? (
              <div className="text-center text-slate-400 py-4">Loading providers...</div>
            ) : (
              <div className="space-y-2">
                <select 
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={providersLoading}
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <select 
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={currentProviderModels.length === 0}
                >
                  {currentProviderModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {currentProviderModels.length === 0 && selectedProvider && (
                  <p className="text-xs text-amber-400">No models available for this provider</p>
                )}
              </div>
            )}
          </div>

          {/* Conversations - Fixed height with scroll */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 pb-2">
              <h3 className="text-xs font-medium text-slate-400">Recent Conversations</h3>
            </div>
            <div className="flex-1 px-4 pb-4 min-h-0">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="text-center text-slate-400 py-4">Loading...</div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {threads.map((thread) => (
                      <div
                        key={thread.id}
                        className="p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 transition-colors cursor-pointer group"
                        onClick={() => handleThreadSelect(thread.id)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-medium text-white truncate flex-1">
                            {thread.title}
                          </h4>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{formatTimeAgo(thread.updated_at)}</span>
                          <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                            {thread.model_name}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {threads.length === 0 && !loading && (
                      <div className="text-center text-slate-500 py-8">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to begin</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </>
      )}

      {/* User Profile at bottom */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-slate-700 text-slate-300">
              {currentUser?.email?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentUser?.email}</p>
            <p className="text-xs text-slate-400">Signed in</p>
          </div>
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-400 hover:text-white p-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
