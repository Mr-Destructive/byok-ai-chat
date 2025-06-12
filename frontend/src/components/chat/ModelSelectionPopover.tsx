
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  name: string;
}

interface ModelSelectionPopoverProps {
  currentProvider: string;
  currentModel: string;
  onModelSelect: (provider: string, model: string) => void;
  className?: string;
  disabled?: boolean;
}

const API_BASE_URL = "http://localhost:8000";

export function ModelSelectionPopover({
  currentProvider,
  currentModel,
  onModelSelect,
  className,
  disabled
}: ModelSelectionPopoverProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProvidersAndModels();
  }, []);

  useEffect(() => {
    setSelectedProvider(currentProvider);
    setSelectedModel(currentModel);
  }, [currentProvider, currentModel]);

  const loadProvidersAndModels = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/providers-and-models`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
        setModelsByProvider(data.models_by_provider);
      }
    } catch (error) {
      console.error('Failed to load providers and models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const availableModels = modelsByProvider[providerId] || [];
    if (availableModels.length > 0) {
      setSelectedModel(availableModels[0]);
    }
  };

  const handleConfirm = () => {
    onModelSelect(selectedProvider, selectedModel);
    setOpen(false);
  };

  const currentProviderModels = modelsByProvider[selectedProvider] || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("h-7 px-2 text-slate-400 hover:text-purple-400 hover:bg-slate-700/50", className)}
        >
          <Shuffle className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-700 text-white" side="top" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Retry with Different Model</h4>
            <p className="text-xs text-slate-400 mb-3">
              Select a different AI model to retry your last message
            </p>
          </div>

          {loading ? (
            <div className="text-center py-4 text-slate-400">Loading models...</div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">
                  Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={currentProviderModels.length === 0}
                >
                  {currentProviderModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {currentProviderModels.length === 0 && selectedProvider && (
                  <p className="text-xs text-amber-400 mt-1">No models available for this provider</p>
                )}
              </div>

              <div className="border-t border-slate-700 pt-3">
                <div className="text-xs text-slate-400 mb-2">Current selection:</div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-slate-700/50 text-slate-300">
                    {providers.find(p => p.id === selectedProvider)?.name || selectedProvider}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-700/50 text-slate-300">
                    {selectedModel}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!selectedModel || currentProviderModels.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
