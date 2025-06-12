
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Key, Eye, EyeOff, Trash2, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  provider: string;
  model_name: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
}

interface Provider {
  id: string;
  name: string;
}

const API_BASE_URL = "http://localhost:8000";

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Get auth token from localStorage
  const getAuthToken = () => localStorage.getItem('authToken');

  useEffect(() => {
    loadProvidersAndModels();
    loadApiKeys();
  }, []);

  const loadProvidersAndModels = async () => {
    setProvidersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/providers-and-models`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
        setModelsByProvider(data.models_by_provider);
      } else {
        throw new Error('Failed to load providers and models');
      }
    } catch (error) {
      console.error('Error loading providers and models:', error);
      toast({
        title: "Error",
        description: "Failed to load available providers and models",
        variant: "destructive"
      });
    } finally {
      setProvidersLoading(false);
    }
  };

  const loadApiKeys = async () => {
    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage API keys",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
      } else {
        throw new Error('Failed to load API keys');
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!selectedProvider || !selectedModel || !keyName || !apiKey) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add API keys",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: selectedProvider,
          model_name: selectedModel,
          api_key: apiKey,
          key_name: keyName,
        }),
      });

      if (response.ok) {
        const newKey = await response.json();
        setApiKeys(prev => [...prev, newKey]);
        setShowForm(false);
        setSelectedProvider('');
        setSelectedModel('');
        setKeyName('');
        setApiKey('');
        
        toast({
          title: "API key added",
          description: "Your API key has been securely stored",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add API key');
      }
    } catch (error) {
      console.error('Error adding API key:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add API key",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
        toast({
          title: "API key deleted",
          description: "The API key has been removed",
        });
      } else {
        throw new Error('Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const availableModels = modelsByProvider[providerId] || [];
    if (availableModels.length > 0) {
      setSelectedModel(availableModels[0]);
    } else {
      setSelectedModel('');
    }
  };

  const getProviderDisplayName = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : providerId;
  };

  const getProviderColor = (providerId: string) => {
    const colors: Record<string, string> = {
      'openai': 'bg-green-500',
      'anthropic': 'bg-orange-500',
      'google': 'bg-blue-500',
      'cohere': 'bg-purple-500',
      'huggingface': 'bg-yellow-500',
      'azure': 'bg-blue-600',
      'bedrock': 'bg-orange-600',
      'vertex_ai': 'bg-blue-400',
      'palm': 'bg-green-400',
      'mistral': 'bg-red-500',
      'together_ai': 'bg-indigo-500',
      'openrouter': 'bg-pink-500',
      'replicate': 'bg-gray-500',
      'anyscale': 'bg-teal-500',
      'perplexity': 'bg-cyan-500',
      'groq': 'bg-lime-500',
      'deepinfra': 'bg-violet-500',
      'ai21': 'bg-blue-700',
      'nlp_cloud': 'bg-emerald-500',
      'aleph_alpha': 'bg-rose-500',
    };
    return colors[providerId] || 'bg-slate-500';
  };

  if (loading || providersLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">API Key Management</h2>
            <p className="text-slate-400 mt-1">Securely manage your AI provider API keys</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add API Key
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {/* Add Key Form */}
          {showForm && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Add New API Key</CardTitle>
                <CardDescription className="text-slate-400">
                  Add an API key for one of the supported providers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="provider" className="text-slate-300">Provider</Label>
                  <select
                    id="provider"
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full mt-1 bg-slate-700 border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a provider...</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProvider && (
                  <div>
                    <Label htmlFor="model" className="text-slate-300">Model</Label>
                    <select
                      id="model"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full mt-1 bg-slate-700 border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      {(modelsByProvider[selectedProvider] || []).map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    {(modelsByProvider[selectedProvider] || []).length === 0 && (
                      <p className="text-xs text-amber-400 mt-1">No models available for this provider</p>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="keyName" className="text-slate-300">Key Name</Label>
                  <Input
                    id="keyName"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g., Main API Key"
                    className="mt-1 bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <Label htmlFor="apiKey" className="text-slate-300">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here..."
                    className="mt-1 bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleAddKey} 
                    disabled={submitting || !selectedProvider || !selectedModel}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {submitting ? 'Adding...' : 'Add Key'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Providers Overview */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Supported Providers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => {
                const providerKeys = apiKeys.filter(key => key.provider === provider.id);
                const modelCount = modelsByProvider[provider.id]?.length || 0;
                return (
                  <Card key={provider.id} className="bg-slate-800/30 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getProviderColor(provider.id)}`} />
                        <h4 className="font-medium text-white">{provider.name}</h4>
                        <Badge variant="secondary" className="ml-auto bg-slate-700 text-slate-300">
                          {providerKeys.length} key{providerKeys.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{modelCount} models available</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* API Keys List */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Your API Keys</h3>
            <div className="space-y-3">
              {apiKeys.map(key => {
                const providerDisplayName = getProviderDisplayName(key.provider);
                
                return (
                  <Card key={key.id} className="bg-slate-800/30 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getProviderColor(key.provider)}`} />
                          <div>
                            <h4 className="font-medium text-white">{key.key_name}</h4>
                            <p className="text-sm text-slate-400">{providerDisplayName} • {key.model_name}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={key.is_active ? 'default' : 'destructive'}
                            className={
                              key.is_active 
                                ? "bg-green-600 text-white" 
                                : "bg-red-600 text-white"
                            }
                          >
                            {key.is_active && <Check className="w-3 h-3 mr-1" />}
                            {!key.is_active && <AlertCircle className="w-3 h-3 mr-1" />}
                            {key.is_active ? 'active' : 'inactive'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteKey(key.id)}
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-500 mt-2">
                        Created: {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              
              {apiKeys.length === 0 && (
                <Card className="bg-slate-800/30 border-slate-700 border-dashed">
                  <CardContent className="p-8 text-center">
                    <Key className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h4 className="font-medium text-slate-300 mb-2">No API keys yet</h4>
                    <p className="text-slate-500 mb-4">Add your first API key to start using BYOK Chat</p>
                    <Button 
                      onClick={() => setShowForm(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Key
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
