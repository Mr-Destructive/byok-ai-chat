import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Paperclip, X, RefreshCw, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { useSidebar } from "../layout/Sidebar";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ChatInterfaceProps {
  currentThreadId?: string;
  setCurrentThreadId: (threadId?: string) => void;
  onThreadCreated: (threadId: string) => void;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
}

interface ApiKey {
  id: string;
  provider: string;
  key_name: string;
  is_active: boolean;
  api_key?: string;
  model_name?: string;
  created_at?: string;
}

export function ChatInterface({
  currentThreadId,
  setCurrentThreadId,
  onThreadCreated,
}: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | undefined>(undefined);
  const { selectedProvider, selectedModel } = useSidebar();

  // Normalize provider for case-insensitive comparison
  const normalizeProvider = (provider: string | undefined) => provider?.toLowerCase().trim() || "";

  // Fetch API keys from backend
  const { 
    data: availableApiKeys = [], 
    isLoading: apiKeysLoading, 
    isError: apiKeysError, 
    error: apiKeysErrorObj, 
    refetch: refetchApiKeys 
  } = useQuery({
    queryKey: ["apiKeys", selectedProvider],
    queryFn: async () => {
      console.log("Fetching API keys for provider:", selectedProvider);
      const keys = await chatApi.getApiKeys();
      console.log("Raw API keys response:", keys);
      if (!Array.isArray(keys)) {
        console.error("Invalid API keys format: Expected array, got:", keys);
        return [];
      }
      const filtered = keys.filter((k: ApiKey) => 
        normalizeProvider(k.provider) === normalizeProvider(selectedProvider) && k.is_active
      );
      console.log("Filtered API keys:", filtered);
      return filtered;
    },
    onError: (error: any) => {
      console.error("Error fetching API keys:", error);
      const errorMessage = error.message || "Failed to load API keys. Please check your connection or authentication.";
      toast({
        title: "API Keys Error",
        description: (
          <>
            {errorMessage}{' '}
            <Button
              variant="link"
              className="p-0 h-auto text-blue-400"
              onClick={() => refetchApiKeys()}
            >
              Retry <RefreshCw className="ml-1 w-4 h-4" />
            </Button>
          </>
        ),
        duration: 10000,
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update selectedApiKeyId when availableApiKeys changes
  useEffect(() => {
    console.log("Available API keys updated:", availableApiKeys);
    if (availableApiKeys.length > 0 && !selectedApiKeyId) {
      setSelectedApiKeyId(availableApiKeys[0].id);
      console.log("Selected API key ID:", availableApiKeys[0].id);
    } else if (availableApiKeys.length === 0) {
      setSelectedApiKeyId(undefined);
      console.log("No API keys available, selectedApiKeyId set to undefined");
    }
  }, [availableApiKeys, selectedApiKeyId]);

  // Helper: check if API key exists for provider
  const hasProviderApiKey = (providerId: string | undefined): boolean => {
    const result = availableApiKeys.some((k: ApiKey) => 
      normalizeProvider(k.provider) === normalizeProvider(providerId) && k.is_active
    );
    console.log(`hasProviderApiKey(${providerId}):`, result);
    return result;
  };

  const { data: messages, refetch: refetchMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", currentThreadId],
    queryFn: () => (currentThreadId ? chatApi.getThreadMessages(currentThreadId) : Promise.resolve([])),
    enabled: !!currentThreadId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, threadId }: { message: string; threadId?: string }) => {
      console.log("Sending message with:", { selectedProvider, selectedApiKeyId });
      if (!selectedProvider) {
        throw new Error("No provider selected. Please select a provider in the sidebar.");
      }
      if (!hasProviderApiKey(selectedProvider)) {
        throw new Error(`No active API key found for provider: ${selectedProvider}. Please add one in the API Keys tab.`);
      }
      try {
        const response = await chatApi.sendMessage({
          message,
          model_name: selectedModel || "openrouter/mistralai/mistral-7b-instruct:free",
          provider: selectedProvider,
          thread_id: threadId,
          stream: true,
          api_key_id: selectedApiKeyId,
        });
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          const reader = response.body?.getReader();
          let result = '';
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.content) {
                      result += data.content;
                    }
                    if (data.error) {
                      throw new Error(data.error);
                    }
                    if (data.done && data.thread_id) {
                      return { thread_id: data.thread_id, content: result };
                    }
                  } catch (e) {
                    console.error('Error parsing stream chunk:', e);
                    throw new Error(`Failed to parse stream chunk: ${e.message}`);
                  }
                }
              }
            }
          }
          if (!result) {
            throw new Error('No content received from stream');
          }
          return { thread_id: threadId, content: result };
        } else {
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }
          return data;
        }
      } catch (error) {
        console.error('Send message failed:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.thread_id && !currentThreadId) {
        setCurrentThreadId(data.thread_id);
        onThreadCreated(data.thread_id);
      }
      refetchMessages();
      setMessage("");
      setFile(null);
      setIsComposing(false);
    },
    onError: (error: any) => {
      console.error("Chat send error object:", error);
      let errorMessage: string | React.ReactNode = 'Failed to send message';
      let toastTitle = 'Message Error';
      let toastOptions: { duration?: number } = {};

      if (error.status === 422) {
        try {
          errorMessage = error.message.includes('detail')
            ? JSON.parse(error.message.match(/\| Response: (.+)/)?.[1] || '{}').detail
            : error.message;
        } catch {
          errorMessage = error.message || 'Validation error';
        }
      } else if (error.message && error.message.includes('INCOMPLETE_CHUNKED_ENCODING')) {
        errorMessage = 'Connection interrupted. Please try again.';
      } else if (error.message && error.message.includes('No active API key found for provider')) {
        let providerName = selectedProvider;
        if (!providerName) {
          const match = error.message.match(/No active API key found for provider: (.*)/);
          providerName = match && match[1] ? match[1] : 'the selected provider';
        }
        const displayProviderName = providerName.charAt(0).toUpperCase() + providerName.slice(1);
        errorMessage = (
          <>
            No active API key for {displayProviderName}. Please add or activate your key on the{' '}
            <Link to="/api-keys" className="underline hover:text-blue-400 transition-colors">API Keys page</Link>.
          </>
        );
        toastTitle = 'API Key Missing';
        toastOptions.duration = 10000;
      } else {
        errorMessage = error.message || String(error) || 'An unknown error occurred.';
      }
      toast({ title: toastTitle, description: errorMessage, ...toastOptions });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() && !file) return;
    if (apiKeysLoading) {
      toast({ title: "Error", description: "API keys are still loading. Please wait." });
      return;
    }
    if (apiKeysError) {
      toast({ title: "Error", description: "Cannot send message due to API key loading error. Please retry loading keys." });
      return;
    }
    if (message.length > 4000) {
      toast({ title: 'Error', description: 'Message is too long. Please keep it under 4000 characters.' });
      return;
    }
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File is too large. Please upload a file smaller than 10MB.' });
        return;
      }
      fileUploadMutation.mutate(file);
    } else {
      sendMessageMutation.mutate({
        message: message.trim(),
        threadId: currentThreadId,
      });
    }
  };

  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      throw new Error('File upload is not supported in this build.');
    },
    onSuccess: (data) => {
      const fileContent = `[File: ${file?.name}] ${message}`;
      sendMessageMutation.mutate({
        message: fileContent,
        threadId: currentThreadId,
      });
    },
    onError: (error) => {
      console.error("Error uploading file:", error);
      toast({ title: 'Error', description: `Failed to upload file. Please try again or check your connection.` });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsComposing(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (!message.trim()) {
      setIsComposing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [message]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const isLoading = sendMessageMutation.isPending || fileUploadMutation.isPending;

  const handleRetryMessage = async (messageIdToRetry: string) => {
    if (!messages) {
      toast.error("Cannot retry: Message list not loaded.");
      return;
    }
    const messageToRetryIndex = messages.findIndex((msg: Message) => msg.id === messageIdToRetry);
    if (messageToRetryIndex === -1) {
      toast.error("Cannot retry: Original message not found.");
      return;
    }
    if (messages[messageToRetryIndex].role !== 'assistant') {
      toast.error("Cannot retry: Only assistant messages can be retried.");
      return;
    }
    let lastUserMessageContent: string | null = null;
    for (let i = messageToRetryIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageContent = messages[i].content;
        break;
      }
    }
    if (!lastUserMessageContent) {
      toast.error("Cannot retry: No preceding user message found to use as context.");
      return;
    }
    toast.info("Retrying message...");
    sendMessageMutation.mutate({
      message: lastUserMessageContent,
      threadId: currentThreadId,
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success("Message copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy message.");
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 text-white">
      <ScrollArea className="flex-1 px-6 py-8" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto space-y-6">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-300">Start a Conversation</h2>
              <p className="text-gray-400 mt-2">
                Type a message below to chat with <span className="text-blue-400">{selectedModel}</span> via{" "}
                <span className="text-blue-400">{selectedProvider}</span>
              </p>
            </div>
          ) : (
            messages?.map((msg: Message) => (
              <ChatMessage
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.created_at}
                type="text"
                onRetryMessage={msg.role === 'assistant' ? handleRetryMessage : undefined}
                onCopyMessage={handleCopyMessage}
              />
            ))
          )}
          {isLoading && !messages?.find((m: Message) => m.role === 'assistant' && m.content === "") && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl px-4 py-3 max-w-[80%] shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm shadow-lg">
        <div className="max-w-3xl mx-auto p-6">
          {apiKeysLoading && (
            <div className="mb-4 p-3 bg-yellow-600/20 text-yellow-300 rounded-lg">
              Loading API keys...
            </div>
          )}
          {apiKeysError && (
            <div className="mb-4 p-3 bg-red-600/20 text-red-300 rounded-lg">
              Failed to load API keys: {apiKeysErrorObj?.message || "Unknown error"}.{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-blue-400"
                onClick={() => refetchApiKeys()}
              >
                Retry <RefreshCw className="ml-1 w-4 h-4" />
              </Button>
            </div>
          )}
          {availableApiKeys.length === 0 && !apiKeysLoading && !apiKeysError && (
            <div className="mb-4 p-3 bg-yellow-600/20 text-yellow-300 rounded-lg">
              No active API key for {selectedProvider || "the selected provider"}. Please add one in the{' '}
              <Link to="/api-keys" className="underline">API Keys page</Link>.
            </div>
          )}
          {availableApiKeys.length > 1 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 mb-1">Select API Key for this chat</label>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white px-3 py-2 focus:ring-2 focus:ring-blue-500"
                value={selectedApiKeyId || ""}
                onChange={(e) => setSelectedApiKeyId(e.target.value)}
              >
                {availableApiKeys.map((key: ApiKey) => (
                  <option key={key.id} value={key.id}>{key.key_name}</option>
                ))}
              </select>
            </div>
          )}
          {file && (
            <div className="mb-4 p-3 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Paperclip className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-200">{file.name}</span>
                <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="h-8 w-8 p-0 hover:bg-gray-700 hover:text-red-400 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-12 w-12 p-0 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors duration-200 rounded-xl"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setIsComposing(e.target.value.trim().length > 0 || !!file);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="min-h-[48px] max-h-[120px] resize-none bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/30 rounded-xl pr-12 py-3 text-sm font-medium transition-all duration-200"
                disabled={isLoading || apiKeysLoading || apiKeysError}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={(!message.trim() && !file) || isLoading || apiKeysLoading || apiKeysError}
              className="flex-shrink-0 h-12 w-12 p-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors duration-200"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <p className="text-xs text-gray-400">
              Using <span className="text-blue-400">{selectedModel}</span> via{" "}
              <span className="text-blue-400">{selectedProvider}</span>
            </p>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />
    </div>
  );
}

export default ChatInterface;
