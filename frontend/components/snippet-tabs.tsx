"use client";

import { useState } from "react";
import type { CodeSnippetTab } from "@/lib/content";
import { CopyButton } from "./copy-button";

interface SnippetTabsProps {
  snippets: readonly CodeSnippetTab[];
}

export function SnippetTabs({ snippets }: SnippetTabsProps) {
  const [activeId, setActiveId] = useState(snippets[0]?.id ?? "");
  const current = snippets.find((snippet) => snippet.id === activeId) ?? snippets[0];
  if (!current) return null;

  return (
    <div className="glass-panel gradient-border overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex gap-1">
          {snippets.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              onClick={() => setActiveId(snippet.id)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ${
                snippet.id === current.id
                  ? "bg-white/[0.06] text-accent-strong"
                  : "text-faint hover:text-muted"
              }`}
            >
              {snippet.label}
            </button>
          ))}
        </div>
        <CopyButton value={current.code} />
      </div>
      <pre className="overflow-x-auto px-5 py-5 font-mono text-sm leading-relaxed text-foreground">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
