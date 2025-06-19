import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, RefreshCw, User2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessageProps {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  type?: "text" | "image" | "search" | "research";
  metadata?: any;
  onRetryMessage?: (messageId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  timestamp,
  type = "text",
  metadata,
  onRetryMessage,
}) => {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";
  const [isMessageCopied, setIsMessageCopied] = useState(false);

  const handleCopyMessage = () => {
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
            {metadata?.filename && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {metadata.filename}
              </p>
            )}
          </div>
        );
      case "search":
        return (
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Web Search Results:</p>
            <p className="text-gray-900 dark:text-white">{content}</p>
            {metadata?.sources && (
              <ul className="list-disc pl-4 text-sm text-gray-600 dark:text-gray-400">
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
            <p className="font-semibold text-gray-900 dark:text-white">Deep Research Analysis:</p>
            <p className="text-gray-900 dark:text-white">{content}</p>
            {metadata?.references && (
              <ul className="list-disc pl-4 text-sm text-gray-600 dark:text-gray-400">
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
                      setTimeout(() => setIsCopied(false), 2000);
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
                        "absolute top-2 right-2 p-1.5 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-200 dark:hover:text-white hover:bg-gray-600 dark:hover:bg-gray-700",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        isCopied && "bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600"
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
                  <code
                    className={cn(
                      className,
                      "bg-gray-600 dark:bg-gray-700 px-1 py-0.5 rounded-sm text-white"
                    )}
                    {...props}
                  >
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
  const avatarColor = isUser ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400";

  if (isSystem) {
    return (
      <div className="flex w-full justify-center group/message">
        <div className="max-w-[70%] p-3 rounded-lg bg-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          {renderContent()}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pt-1">
            {format(new Date(timestamp), "PPP p")}
          </p>
        </div>
      </div>
    );
  }

  const messageBubble = (
    <div
      className={cn(
        "relative max-w-[85%] p-3 rounded-lg shadow-md group/actions",
        isUser
          ? "bg-blue-600 dark:bg-blue-500 text-white dark:text-white rounded-br-none"
          : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none"
      )}
    >
      <div className="prose prose-sm max-w-none message-content">
        {renderContent()}
      </div>

      {/* Bottom-right controls */}
      <div className="flex justify-end items-center gap-2 mt-3">
        {isAssistant && onRetryMessage && (
          <button
            onClick={() => onRetryMessage(id)}
            className="p-1 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
            aria-label="Retry message"
            title="Retry message"
          >
            <RefreshCw size={14} />
          </button>
        )}
        <button
          onClick={handleCopyMessage}
          className={cn(
            "p-1 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-600",
            isMessageCopied && "bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700"
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
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          {format(new Date(timestamp), "p")}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full items-start space-x-3 group/message",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mt-1">
          <AvatarComponent size={18} className={avatarColor} />
        </div>
      )}
      {messageBubble}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mt-1">
          <AvatarComponent size={18} className={avatarColor} />
        </div>
      )}
    </div>
  );
};
