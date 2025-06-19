
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessageProps {
  role: string;
  content: string;
  timestamp: string;
  type?: 'text' | 'image' | 'search' | 'research';
  metadata?: any;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, timestamp, type = 'text', metadata }) => {
  const isUser = role === "user";
  const isSystem = role === "system";

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
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
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

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        isSystem && "justify-center"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] p-3 rounded-lg",
          isUser
            ? "bg-blue-600 text-white"
            : isSystem
            ? "bg-slate-700 text-white"
            : "bg-gray-700 text-white"
        )}
      >
        {renderContent()}
        <p className="text-xs text-slate-300 mt-1">
          {format(new Date(timestamp), "PPP p")}
        </p>
      </div>
    </div>
  );
};


