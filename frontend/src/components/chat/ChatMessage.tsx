
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ThumbsUp, ThumbsDown, User, Bot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelectionPopover } from "./ModelSelectionPopover";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
}

interface ChatMessageProps {
  message: Message;
  onCopy: () => void;
  onFeedback: (type: 'up' | 'down') => void;
  onRetry?: () => void;
  onRetryWithDifferentModel?: (provider: string, model: string) => void;
  isLoading?: boolean;
  currentProvider?: string;
  currentModel?: string;
}

export function ChatMessage({ 
  message, 
  onCopy, 
  onFeedback, 
  onRetry, 
  onRetryWithDifferentModel,
  isLoading,
  currentProvider = 'openai',
  currentModel = 'gpt-4'
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  const handleModelSelect = (provider: string, model: string) => {
    onRetryWithDifferentModel?.(provider, model);
  };

  return (
    <div className={cn(
      "flex gap-4 group max-w-4xl mx-auto",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        isUser 
          ? "bg-blue-600" 
          : "bg-gradient-to-br from-emerald-500 to-teal-600"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "max-w-[80%]" : "max-w-full"
      )}>
        {/* Model badge for assistant messages */}
        {!isUser && (message.model || message.provider) && (
          <div className="flex items-center gap-2">
            {message.provider && (
              <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                {message.provider}
              </Badge>
            )}
            {message.model && (
              <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                {message.model}
              </Badge>
            )}
          </div>
        )}

        <div className={cn(
          "rounded-lg px-4 py-3 break-words",
          isUser 
            ? "bg-blue-600 text-white ml-auto" 
            : "bg-slate-800/50 text-slate-100 border border-slate-700/50"
        )}>
          <div className="whitespace-pre-wrap leading-relaxed">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
            )}
          </div>
        </div>

        {/* Message Actions */}
        <div className="flex items-center justify-between">
          <div className={cn(
            "text-xs text-slate-500",
            isUser ? "text-right order-2" : "text-left order-1"
          )}>
            {message.timestamp.toLocaleTimeString()}
          </div>

          {!message.isStreaming && (
            <div className={cn(
              "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isUser ? "order-1" : "order-2"
            )}>
              {/* Copy button for both user and assistant messages */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <Copy className="w-3 h-3" />
              </Button>

              {/* Additional actions for assistant messages */}
              {!isUser && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFeedback('up')}
                    className="h-7 px-2 text-slate-400 hover:text-green-400 hover:bg-slate-700/50"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFeedback('down')}
                    className="h-7 px-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </Button>
                  {onRetry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRetry}
                      disabled={isLoading}
                      className="h-7 px-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50"
                    >
                      <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                    </Button>
                  )}
                  {onRetryWithDifferentModel && (
                    <ModelSelectionPopover
                      currentProvider={currentProvider}
                      currentModel={currentModel}
                      onModelSelect={handleModelSelect}
                      disabled={isLoading}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
