
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
}

interface ChatInterfaceProps {
  selectedModel: string;
  selectedProvider: string;
  currentThreadId?: string;
  onThreadCreated?: (threadId: string) => void;
  onModelChange?: (model: string) => void;
  onProviderChange?: (provider: string) => void;
}

const API_BASE_URL = "http://localhost:8001";

export function ChatInterface({
  selectedModel,
  selectedProvider,
  currentThreadId,
  onThreadCreated,
  onModelChange,
  onProviderChange
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getAuthToken = () => localStorage.getItem('authToken');

  // Load messages when thread changes
  useEffect(() => {
    if (currentThreadId) {
      loadThreadMessages();
    } else {
      setMessages([]);
    }
  }, [currentThreadId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const loadThreadMessages = async () => {
    if (!currentThreadId) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const messagesData = await response.json();
        const formattedMessages = messagesData.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load thread messages:', error);
    }
  };

  const sendMessage = async (messageContent: string, retryProvider?: string, retryModel?: string) => {
    if (!messageContent.trim()) return;

    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please log in to send messages",
        variant: "destructive"
      });
      return;
    }

    const effectiveProvider = retryProvider || selectedProvider;
    const effectiveModel = retryModel || selectedModel;

    setIsLoading(true);
    
    // Add user message if not retrying
    if (!retryProvider && !retryModel) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInputValue("");
    }

    // Add streaming assistant message
    const assistantMessageId = Date.now().toString() + "_assistant";
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      model: effectiveModel,
      provider: effectiveProvider,
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          thread_id: currentThreadId,
          provider: effectiveProvider,
          model_name: effectiveModel,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let fullContent = '';
      let threadId = currentThreadId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                fullContent += data.content;
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: fullContent }
                      : msg
                  )
                );
              }
              
              if (data.done && data.thread_id && !threadId) {
                threadId = data.thread_id;
                onThreadCreated?.(threadId);
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

      // Mark message as complete
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

      // Update model and provider if they were changed during retry
      if (retryProvider && retryModel) {
        onProviderChange?.(retryProvider);
        onModelChange?.(retryModel);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the failed assistant message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setRetryingMessageId(null);
    }
  };

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied to clipboard",
      description: "Message content has been copied",
    });
  };

  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    toast({
      title: "Feedback recorded",
      description: `Thanks for your ${type === 'up' ? 'positive' : 'negative'} feedback!`,
    });
  };

  const handleRetry = (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;

    const userMessage = messages[userMessageIndex];
    
    // Remove the assistant message we're retrying
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    setRetryingMessageId(messageId);
    
    // Resend with same model
    sendMessage(userMessage.content);
  };

  const handleRetryWithDifferentModel = (messageId: string, provider: string, model: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;

    const userMessage = messages[userMessageIndex];
    
    // Remove the assistant message we're retrying
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    setRetryingMessageId(messageId);
    
    // Resend with different model
    sendMessage(userMessage.content, provider, model);
  };

  if (messages.length === 0 && !currentThreadId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to BYOK Chat</h2>
        <p className="text-slate-400 mb-8 max-w-md">
          Start a conversation with AI using your own API keys. Your conversations are private and secure.
        </p>
        <div className="w-full max-w-2xl">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="flex-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="space-y-6 p-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCopy={() => handleCopy(message.content)}
                onFeedback={(type) => handleFeedback(message.id, type)}
                onRetry={message.role === 'assistant' ? () => handleRetry(message.id) : undefined}
                onRetryWithDifferentModel={message.role === 'assistant' ? (provider, model) => handleRetryWithDifferentModel(message.id, provider, model) : undefined}
                isLoading={isLoading && retryingMessageId === message.id}
                currentProvider={selectedProvider}
                currentModel={selectedModel}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/50 p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="flex-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
