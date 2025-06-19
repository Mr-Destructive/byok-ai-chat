
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, RefreshCw, User2, Bot } from "lucide-react"; // Added User2 and Bot
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessageProps {
  id: string; // Added id
  role: string;
  content: string;
  timestamp: string;
  type?: 'text' | 'image' | 'search' | 'research';
  metadata?: any;
  onRetryMessage?: (messageId: string) => void; // Added onRetryMessage
  // isLoadingRetry?: boolean; // Optional: for specific loading state for this message's retry
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  timestamp,
  type = 'text',
  metadata,
  onRetryMessage,
  // isLoadingRetry
}) => {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";
  const [isMessageCopied, setIsMessageCopied] = useState(false);

  const handleCopyMessage = () => {
    // For now, we copy the raw 'content' string.
    // Enhancements could involve serializing metadata for other types if needed.
    navigator.clipboard.writeText(content).then(
      () => {
        setIsMessageCopied(true);
        setTimeout(() => setIsMessageCopied(false), 2000);
      },
      (err) => {
        console.error("Failed to copy message: ", err);
      }
    );
  };

  const renderContent = () => {
    switch (type) {
      case "image":
        return (
          <div className="max-w-sm">
            <img
              src={content}
              alt={metadata?.alt || "Generated image"}
              className="w-full h-auto rounded-md"
            />
            {metadata?.filename && <p className="text-sm text-slate-400 mt-1">{metadata.filename}</p>}
          </div>
        );
      case "search":
        return (
          <div>
            <p className="font-semibold">Web Search Results:</p>
            <p>{content}</p>
            {metadata?.sources && (
              <ul className="list-disc pl-4 text-sm text-slate-400">
                {metadata.sources.map((source: string, index: number) => (
                  <li key={index}>{source}</li>
                ))}
              </ul>
            )}
          </div>
        );
      case "research":
        return (
          <div>
            <p className="font-semibold">Deep Research Analysis:</p>
            <p>{content}</p>
            {metadata?.references && (
              <ul className="list-disc pl-4 text-sm text-slate-400">
                {metadata.references.map((ref: string, index: number) => (
                  <li key={index}>{ref}</li>
                ))}
              </ul>
            )}
          </div>
        );
      default:
        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                const [isCopied, setIsCopied] = useState(false);

                const handleCopy = () => {
                  navigator.clipboard.writeText(codeString).then(
                    () => {
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
                    },
                    (err) => {
                      console.error("Failed to copy: ", err);
                    }
                  );
                };

                return !inline && match ? (
                  <div className="relative group">
                    <button
                      onClick={handleCopy}
                      className={cn(
                        "absolute top-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700",
                        "opacity-0 group-hover:opacity-100 transition-opacity", // Show on hover
                        isCopied && "bg-green-600 text-white hover:bg-green-700" // Copied state style
                      )}
                      aria-label={isCopied ? "Copied!" : "Copy code"}
                    >
                      {isCopied ? (
                        <span className="text-xs">Copied!</span>
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={cn(className, "bg-slate-600 px-1 py-0.5 rounded-sm")} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        );
    }
  };

  const AvatarComponent = isUser ? User2 : Bot;
  const avatarColor = isUser ? "text-blue-300" : "text-purple-300";

  // System messages will not have an avatar and will be centered
  if (isSystem) {
    return (
      <div className="flex w-full justify-center group/message">
        <div className="max-w-[70%] p-3 rounded-lg bg-slate-700 text-white text-sm">
          {renderContent()}
          <p className="text-xs text-slate-300 mt-1 pt-1">
            {format(new Date(timestamp), "PPP p")}
          </p>
        </div>
      </div>
    );
  }

  const messageBubble = (
    <div
      className={cn(
        "relative max-w-[85%] p-3 rounded-lg shadow-md group/actions", // Increased max-width slightly
        isUser
          ? "bg-blue-600 text-white rounded-br-none" // Different rounding for user
          : "bg-gray-700 text-white rounded-bl-none"  // Different rounding for assistant
      )}
    >
      <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-0 group-hover/actions:opacity-100 transition-opacity duration-200 z-10">
        {isAssistant && onRetryMessage && (
          <button
            onClick={() => onRetryMessage(id)}
            className="p-1 rounded-md text-slate-200 hover:text-white hover:bg-slate-600/70"
            aria-label="Retry message"
            title="Retry message"
          >
            <RefreshCw size={14} />
          </button>
        )}
        <button
          onClick={handleCopyMessage}
          className={cn(
            "p-1 rounded-md text-slate-200 hover:text-white hover:bg-slate-600/70",
            isMessageCopied && "bg-green-500 hover:bg-green-600"
          )}
          aria-label={isMessageCopied ? "Message Copied!" : "Copy message"}
          title={isMessageCopied ? "Message Copied!" : "Copy message"}
        >
          {isMessageCopied ? (
            <span className="text-xs px-1">Copied!</span>
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
      <div className="prose prose-sm prose-invert max-w-none message-content"> {/* Added prose styles for markdown */}
         {renderContent()}
      </div>
      <p className="text-xs text-slate-300 mt-2 pt-1 text-right"> {/* Timestamp to the right */}
        {format(new Date(timestamp), "p")} {/* Only time for brevity */}
      </p>
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full items-start space-x-3 group/message", // items-start for avatar alignment
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center mt-1">
          <AvatarComponent size={18} className={avatarColor} />
        </div>
      )}
      {messageBubble}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center mt-1">
          <AvatarComponent size={18} className={avatarColor} />
        </div>
      )}
    </div>
  );
};


