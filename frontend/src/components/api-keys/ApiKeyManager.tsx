
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Key, Eye, EyeOff, Trash2, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiKeysApi } from "@/lib/api";

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

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadProvidersAndModels();
    loadApiKeys();
  }, []);

  const loadProvidersAndModels = async () => {
    setProvidersLoading(true);
    try {
      const data = await apiKeysApi.getProvidersAndModels();
      const providersList = Array.isArray(data.providers) ? data.providers : [];
      setProviders(providersList);
      setModelsByProvider(data.models_by_provider || {});
    } catch (error) {
      console.error('Error loading providers and models:', error);
      toast({
        title: "Error",
        description: "Failed to load available providers and models",
        variant: "destructive",
      });
    } finally {
      setProvidersLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const keys = await apiKeysApi.getApiKeys();
      setApiKeys(keys);
      localStorage.setItem('apiKeys', JSON.stringify(keys.filter((k: ApiKey) => k.is_active)));
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: "Error",
        description: "Failed to load API keys. Please log in again.",
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiKeysApi.createApiKey({
        provider: selectedProvider,
        model_name: selectedModel,
        key_name: keyName,
        api_key: apiKey,
      });
      await loadApiKeys();
      setShowModal(false);
      setSelectedProvider('');
      setSelectedModel('');
      setKeyName('');
      setApiKey('');
      toast({
        title: "Success",
        description: "API key added successfully",
      });
    } catch (error) {
      console.error('Error adding API key:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add API key',
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiKeysApi.deleteApiKey(keyId);
      await loadApiKeys();
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete API key',
        variant: "destructive",
      });
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const availableModels = modelsByProvider[providerId] || [];
    setSelectedModel(availableModels.length > 0 ? availableModels[0] : '');
  };

  const toggleProviderExpansion = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const getProviderDisplayName = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.name : providerId;
  };

  const getProviderColor = (providerId: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-500',
      anthropic: 'bg-orange-500',
      google: 'bg-blue-500',
      cohere: 'bg-purple-500',
      huggingface: 'bg-yellow-500',
      azure: 'bg-blue-600',
      bedrock: 'bg-orange-600',
      vertex_ai: 'bg-blue-400',
      palm: 'bg-green-400',
      mistral: 'bg-red-500',
      together_ai: 'bg-indigo-500',
      openrouter: 'bg-pink-500',
      replicate: 'bg-gray-500',
      anyscale: 'bg-teal-500',
      perplexity: 'bg-cyan-500',
      groq: 'bg-lime-500',
      deepinfra: 'bg-violet-500',
      ai21: 'bg-blue-700',
      nlp_cloud: 'bg-emerald-500',
      aleph_alpha: 'bg-rose-500',
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
    <div className="h-full w-full flex flex-col items-center justify-start bg-slate-900 py-8 px-2 overflow-auto">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        <div className="p-6 border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">API Key Management</h2>
              <p className="text-slate-400 mt-1">Securely manage your AI provider API keys</p>
            </div>
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Add New API Key</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Enter your API key details below. Ensure you select the correct provider and model.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="provider" className="text-right text-slate-300">
                      Provider
                    </Label>
                    <select
                      id="provider"
                      value={selectedProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="col-span-3 bg-slate-700 border-slate-600 text-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a provider...</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProvider && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="model" className="text-right text-slate-300">
                        Model
                      </Label>
                      <select
                        id="model"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="col-span-3 bg-slate-700 border-slate-600 text-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a model...</option>
                        {(modelsByProvider[selectedProvider] || []).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      {(modelsByProvider[selectedProvider] || []).length === 0 && (
                        <p className="col-span-4 text-xs text-amber-400 mt-1 text-center">No models available for this provider</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="keyName" className="text-right text-slate-300">
                      Key Name
                    </Label>
                    <Input
                      id="keyName"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g., My OpenAI Key"
                      className="col-span-3 bg-slate-700 border-slate-600 text-slate-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="apiKey" className="text-right text-slate-300">
                      API Key
                    </Label>
                    <div className="col-span-3 relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your API key here"
                        className="bg-slate-700 border-slate-600 text-slate-100 focus:ring-2 focus:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleAddKey}
                    disabled={submitting || !selectedProvider || !selectedModel || !keyName || !apiKey}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {submitting ? 'Adding...' : 'Add API Key'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* The old Card-based modal structure is removed. */}

        <ScrollArea className="flex-1">
          {Object.entries(
            apiKeys.reduce((acc, key) => {
              acc[key.provider] = acc[key.provider] || [];
              acc[key.provider].push(key);
              return acc;
            }, {} as Record<string, ApiKey[]>)
          ).map(([providerId, keys]) => (
              acc[key.provider] = acc[key.provider] || [];
              acc[key.provider].push(key);
              return acc;
            }, {} as Record<string, ApiKey[]>)
          ).map(([providerId, keys]) => (
            <Card key={providerId} className="mb-4 bg-slate-800 border-slate-700 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-slate-300" />
                  <CardTitle className="text-slate-100">{getProviderDisplayName(providerId)}</CardTitle>
                </div>
                <Badge className={`${getProviderColor(providerId)} text-white`}>
                  {keys.length} {keys.length === 1 ? 'key' : 'keys'}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {keys
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-3 bg-slate-700 rounded-lg" // Solid bg-slate-700
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-100">{key.key_name}</p>
                          <p className="text-xs text-slate-400">Model: {key.model_name}</p>
                          <p className="text-xs text-slate-400">
                            Added: {new Date(key.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={key.is_active ? 'default' : 'secondary'}
                            className={key.is_active ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-200'}
                          >
                            {key.is_active ? <Check className="h-4 w-4 mr-1" /> : <AlertCircle className="h-4 w-4 mr-1" />}
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKey(key.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-slate-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {apiKeys.length === 0 && (
            <p className="text-center text-slate-400">No API keys added yet.</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}