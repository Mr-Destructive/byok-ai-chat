
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
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-white animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center bg-gray-900 py-12 px-4 overflow-auto">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <div className="p-8 rounded-2xl bg-gray-800/50 backdrop-blur-lg border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">API Key Management</h2>
              <p className="text-gray-400 mt-2">Securely manage your AI provider API keys for seamless integration.</p>
            </div>
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                  <Plus className="mr-2 h-5 w-5" /> Add API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-700 text-white sm:max-w-[500px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl">Add New API Key</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Enter your API key details below. Ensure you select the correct provider and model.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="provider" className="text-right text-gray-300 font-medium">
                      Provider
                    </Label>
                    <select
                      id="provider"
                      value={selectedProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="col-span-3 bg-gray-700 border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 transition-all"
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
                      <Label htmlFor="model" className="text-right text-gray-300 font-medium">
                        Model
                      </Label>
                      <select
                        id="model"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="col-span-3 bg-gray-700 border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="">Select a model...</option>
                        {(modelsByProvider[selectedProvider] || []).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      {(modelsByProvider[selectedProvider] || []).length === 0 && (
                        <p className="col-span-4 text-xs text-amber-400 mt-2 text-center">No models available for this provider</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="keyName" className="text-right text-gray-300 font-medium">
                      Key Name
                    </Label>
                    <Input
                      id="keyName"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g., My OpenAI Key"
                      className="col-span-3 bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="apiKey" className="text-right text-gray-300 font-medium">
                      API Key
                    </Label>
                    <div className="col-span-3 relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your API key here"
                        className="bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      >
                        {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg px-6 py-2">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleAddKey}
                    disabled={submitting || !selectedProvider || !selectedModel || !keyName || !apiKey}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2"
                  >
                    {submitting ? 'Adding...' : 'Add API Key'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {Object.entries(
            apiKeys.reduce((acc, key) => {
              acc[key.provider] = acc[key.provider] || [];
              acc[key.provider].push(key);
              return acc;
            }, {} as Record<string, ApiKey[]>)
          ).map(([providerId, keys]) => (
            <Card key={providerId} className="mb-6 bg-gray-800/70 border-gray-700/50 text-white rounded-2xl shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <Key className="h-6 w-6 text-gray-300" />
                  <CardTitle className="text-xl font-semibold">{getProviderDisplayName(providerId)}</CardTitle>
                </div>
                <Badge className={`${getProviderColor(providerId)} text-white px-3 py-1 rounded-full`}>
                  {keys.length} {keys.length === 1 ? 'key' : 'keys'}
                </Badge>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="space-y-3">
                  {keys
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl border border-gray-600/50"
                      >
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-white">{key.key_name}</p>
                          <p className="text-xs text-gray-400">Model: {key.model_name}</p>
                          <p className="text-xs text-gray-400">
                            Added: {new Date(key.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={key.is_active ? 'default' : 'secondary'}
                            className={key.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}
                          >
                            {key.is_active ? <Check className="h-4 w-4 mr-1" /> : <AlertCircle className="h-4 w-4 mr-1" />}
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKey(key.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-gray-600 rounded-full p-2"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {apiKeys.length === 0 && (
            <p className="text-center text-gray-400 text-lg py-12">No API keys added yet. Start by adding a key above.</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
