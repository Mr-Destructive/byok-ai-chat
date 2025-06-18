import React from "react";
import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager";

import { KeyRound } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Sticky Top Nav */}
      <div className="sticky top-0 z-40 w-full bg-sidebar/90 border-b border-sidebar-border flex items-center justify-between px-6 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <KeyRound className="w-7 h-7 text-blue-500" />
          <span className="text-xl font-bold text-sidebar-foreground">API Key Management</span>
        </div>
        {/* Theme Toggle Placeholder (implement actual toggle logic in App if needed) */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-sidebar-foreground/70">Theme</span>
          <button className="rounded-full p-1 hover:bg-sidebar-accent transition-colors">
            {/* Replace with actual theme icon toggle */}
            <svg width="18" height="18" fill="none"><circle cx="9" cy="9" r="8" stroke="#3b82f6" strokeWidth="2" /></svg>
          </button>
        </div>
      </div>
      {/* Main Content Scrollable Area */}
      <div className="flex-1 flex flex-col items-center justify-start py-10 px-2 overflow-y-auto">
        <div className="w-full max-w-lg bg-sidebar rounded-2xl shadow-2xl p-8 border border-sidebar-border flex flex-col items-center">
          <p className="mb-6 text-sm text-sidebar-foreground/70 text-center max-w-md">
            Manage your API keys for all providers here. Keys are stored securely in your browser and never leave your device. Add, edit, or remove keys to enable chat with different providers.
          </p>
          <div className="w-full">
            <ApiKeyManager />
          </div>
        </div>
      </div>
    </div>
  );
}
