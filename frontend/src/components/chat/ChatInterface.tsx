import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Paperclip, X, RefreshCw } from "lucide-react"; // Added RefreshCw just in case, though not strictly needed here
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { useSidebar } from "../layout/Sidebar";
import { toast } from "sonner"; // Already using sonner for toasts

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
  const [availableApiKeys, setAvailableApiKeys] = useState<any[]>([]);

  const { selectedProvider, selectedModel } = useSidebar();
  // Helper: check if API key exists for provider
  // Always use provider id for API key lookup
  const hasProviderApiKey = (providerId: string): boolean => {
    try {
      const keysRaw = localStorage.getItem('apiKeys');
      if (!keysRaw) return false;
      const keys = JSON.parse(keysRaw);
      return Array.isArray(keys) && keys.some((k: any) => k.provider === providerId && k.is_active);
    } catch {
      return false;
    }
  };

  // Update availableApiKeys and selectedApiKeyId when provider or model changes
  useEffect(() => {
    try {
      const keysRaw = localStorage.getItem('apiKeys');
      if (!keysRaw) return setAvailableApiKeys([]);
      const keys = JSON.parse(keysRaw);
      // Always use provider id for filtering
      const filtered = Array.isArray(keys) ? keys.filter((k: any) => k.provider === selectedProvider && k.is_active) : [];
      setAvailableApiKeys(filtered);
      // Reset selectedApiKeyId if provider changes
      if (filtered.length > 0) {
        setSelectedApiKeyId(filtered[0].id);
      } else {
        setSelectedApiKeyId(undefined);
      }
    } catch {
      setAvailableApiKeys([]);
      setSelectedApiKeyId(undefined);
    }
  }, [selectedProvider, selectedModel]); // include selectedModel for robustness

  useEffect(() => {
    // removed debug log("ChatInterface props updated:", { selectedProvider, selectedModel });
  }, [selectedProvider, selectedModel]);

  const { data: messages, refetch: refetchMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", currentThreadId],
    queryFn: () => (currentThreadId ? chatApi.getThreadMessages(currentThreadId) : Promise.resolve([])),
    enabled: !!currentThreadId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, threadId }: { message: string; threadId?: string }) => {
      if (!hasProviderApiKey(selectedProvider)) {
        throw new Error(`No active API key found for provider: ${selectedProvider}. Please add one in the API Keys tab.`);
      }
      // removed debug log("Sending message:", { message, provider: selectedProvider, model_name: selectedModel, threadId });
      try {
        const response = await chatApi.sendMessage({
          message,
          model_name: selectedModel || "openrouter/mistralai/mistral-7b-instruct:free",
          provider: selectedProvider || "openrouter",
          thread_id: threadId,
          stream: true,
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
      let errorMessage = 'Failed to send message';
      if (error.status === 422) {
        try {
          errorMessage = error.message.includes('detail') 
            ? JSON.parse(error.message.match(/\| Response: (.+)/)?.[1] || '{}').detail
            : error.message;
        } catch {
          errorMessage = error.message;
        }
      } else if (error.message.includes('INCOMPLETE_CHUNKED_ENCODING')) {
        errorMessage = 'Connection interrupted. Please try again.';
      } else if (error.message.includes('No active API key found for provider')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message || error.toString();
      }
      console.error("Error sending message:", errorMessage);
      toast({ title: 'Error', description: errorMessage });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() && !file) return;
    
    if (message.length > 4000) {
      toast({ title: 'Error', description: 'Message is too long. Please keep it under 4000 characters.'});
      return;
    }

    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File is too large. Please upload a file smaller than 10MB.'});
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

  // File upload is not implemented in chatApi. Show error if attempted.
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
      toast({ title: 'Error', description: `Failed to upload file. Please try again or check your connection.`});
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
  }, []);

  const isLoading = sendMessageMutation.isPending || fileUploadMutation.isPending;

  const handleRetryMessage = async (messageIdToRetry: string) => {
    if (!messages) {
      toast.error("Cannot retry: Message list not loaded.");
      return;
    }

    const messageToRetryIndex = messages.findIndex(msg => msg.id === messageIdToRetry);

    if (messageToRetryIndex === -1) {
      toast.error("Cannot retry: Original message not found.");
      return;
    }

    if (messages[messageToRetryIndex].role !== 'assistant') {
      toast.error("Cannot retry: Only assistant messages can be retried.");
      return;
    }

    // Find the last user message *before* the assistant message to be retried
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

    // Optional: Remove the failed assistant message and any subsequent messages
    // For now, we will just send the request and let the new response appear.
    // If you want to remove the old message, you'd need to update the local cache or refetch carefully.
    // Example: queryClient.setQueryData(['messages', currentThreadId], (oldData: Message[] | undefined) => oldData ? oldData.slice(0, messageToRetryIndex) : []);


    toast.info("Retrying message...");
    sendMessageMutation.mutate({
      message: lastUserMessageContent, // Send the content of the *preceding user message*
      threadId: currentThreadId,
      // Potentially add a flag here if your backend needs to know it's a retry
    });
  };

  useEffect(() => {
    try {
      const keysRaw = localStorage.getItem('apiKeys');
      if (!keysRaw) return setAvailableApiKeys([]);
      const keys = JSON.parse(keysRaw);
      const filtered = Array.isArray(keys) ? keys.filter((k: any) => k.provider === selectedProvider && k.is_active) : [];
      setAvailableApiKeys(filtered);
      if (filtered.length > 0 && !selectedApiKeyId) {
        setSelectedApiKeyId(filtered[0].id);
      }
    } catch {
      setAvailableApiKeys([]);
    }
  }, [selectedProvider]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground">
      <ScrollArea className="flex-1 px-6 py-8" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto space-y-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-300">Start a Conversation</h2>
              <p className="text-muted-foreground mt-2">
                Type a message below to chat with <span className="text-blue-400">{selectedModel}</span> via{" "}
                <span className="text-blue-400">{selectedProvider}</span>
              </p>
            </div>
          ) : (
            messages?.map((msg: Message) => (
              <ChatMessage
                key={msg.id}
                id={msg.id} // Pass the id
                role={msg.role}
                content={msg.content}
                timestamp={msg.created_at}
                type="text" // Assuming text for now, this might need to be dynamic later
                onRetryMessage={msg.role === 'assistant' ? handleRetryMessage : undefined}
                // isLoadingRetry={retryingMessageId === msg.id && sendMessageMutation.isPending} // If using specific loading state
              />
            ))
          )}
          {isLoading && !messages?.find(m => m.role === 'assistant' && m.content === "") && ( // Avoid showing global loading if it's a retry of an existing message
            <div className="flex justify-start">
              <div className="bg-card rounded-2xl px-4 py-3 max-w-[80%] shadow-sm">
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
      {/* Chat Prompt Area */}
      <div className="border-t border-border bg-card/95 backdrop-blur-sm shadow-lg dark:bg-gray-900/95">
        <div className="max-w-3xl mx-auto p-6">
          {/* API Key Dropdown if multiple keys for provider */}
          {availableApiKeys.length > 1 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Select API Key for this chat</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500"
                value={selectedApiKeyId}
                onChange={e => setSelectedApiKeyId(e.target.value)}
              >
                {availableApiKeys.map((key) => (
                  <option key={key.id} value={key.id}>{key.key_name}</option>
                ))}
              </select>
            </div>
          )}
          {file && (
            <div className="mb-4 p-3 bg-card rounded-xl border border-gray-700 dark:border-gray-600 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Paperclip className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-gray-200 dark:text-gray-400">{file.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
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
          {/* ...rest of prompt area... */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8 p-0 hover:bg-gray-700 transition-colors duration-200"
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
                className="min-h-[48px] max-h-[120px] resize-none bg-card border-gray-700 text-foreground placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/30 rounded-xl pr-12 py-3 text-sm font-medium transition-all duration-200"
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={(!message.trim() && !file) || isLoading}
              className="flex-shrink-0 h-12 w-12 p-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors duration-200"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
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
};

export default ChatInterface;