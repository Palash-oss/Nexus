"use client";

import { Search, Keyboard, Info, Globe } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";

import { ConnectIndexButton } from "@/components/search/connect-index-button";
import { ResultCard } from "@/components/search/result-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutsModal } from "@/components/search/keyboard-shortcuts-modal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { SearchApiResponse, SearchResultItem } from "@/types/search";
import type { ParsedQuery } from "@/lib/queryParser";

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-xl border border-nexus-border bg-white/80" />
      ))}
    </div>
  );
}

export function SearchShell({ userName }: { userName: string | null | undefined }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ count: number; tookMs: number }>({ count: 0, tookMs: 0 });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Advanced States
  const [activeSource, setActiveSource] = useState<"ALL" | "GMAIL" | "DRIVE" | "WEB">("ALL");
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [searchType, setSearchType] = useState<"hybrid" | "keyword">("keyword");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [showWebBanner, setShowWebBanner] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const showEmptyState = useMemo(() => !loading && query.length > 0 && results.length === 0 && !error, [
    loading,
    query,
    results.length,
    error,
  ]);

  // Handle keyboard shortcut registrations
  useKeyboardShortcuts({
    onFocusSearch: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    onClearSearch: () => {
      setQuery("");
      setResults([]);
      setMeta({ count: 0, tookMs: 0 });
      setParsedQuery(null);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    },
    onToggleHelp: () => {
      setShortcutsModalOpen((prev) => !prev);
    },
    onNavigateResults: (direction) => {
      if (results.length === 0) return;
      setHighlightedIndex((prev) => {
        if (direction === "down") {
          return (prev + 1) % results.length;
        } else {
          return prev <= 0 ? results.length - 1 : prev - 1;
        }
      });
    },
    onSelectResult: () => {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        window.open(results[highlightedIndex].url, "_blank");
      }
    },
    isSearchFocused: document.activeElement === inputRef.current || highlightedIndex >= 0,
  });

  // Query API
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setMeta({ count: 0, tookMs: 0 });
      setParsedQuery(null);
      setError(null);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setHighlightedIndex(-1);

      try {
        const sourceFilterQuery = activeSource !== "ALL" ? `&sources=${activeSource}` : "";
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}${sourceFilterQuery}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as SearchApiResponse & {
          error?: string;
          parsedQuery?: ParsedQuery;
          searchType?: "hybrid" | "keyword";
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Search request failed.");
        }

        setResults(payload.results);
        setMeta({ count: payload.count, tookMs: payload.tookMs });
        setParsedQuery(payload.parsedQuery ?? null);
        setSearchType(payload.searchType ?? "keyword");

        // Web banner checker: show the first time a user receives web results
        const hasWebResults = payload.results.some((r) => r.source === "WEB");
        if (hasWebResults) {
          const hasSeenBanner = localStorage.getItem("hasSeenWebBanner");
          if (!hasSeenBanner) {
            setShowWebBanner(true);
          }
        }
      } catch (requestError) {
        setResults([]);
        setMeta({ count: 0, tookMs: 0 });
        setParsedQuery(null);
        setError((requestError as Error).message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeSource, refreshKey]);

  // Clean Web Banner seen flag
  function dismissWebBanner() {
    localStorage.setItem("hasSeenWebBanner", "true");
    setShowWebBanner(false);
  }

  // Format parsed query intent text
  const intentDescription = useMemo(() => {
    if (!parsedQuery) return null;
    const parts: string[] = [];

    if (parsedQuery.intent === "find_email") {
      parts.push("Searching in Gmail");
    } else if (parsedQuery.intent === "find_file") {
      parts.push("Searching in Google Drive");
    } else if (parsedQuery.intent === "find_page") {
      parts.push("Searching browsing history");
    } else {
      parts.push("Searching all apps");
    }

    if (parsedQuery.author) {
      parts.push(`shared by ${parsedQuery.author}`);
    }

    if (parsedQuery.dateRange && (parsedQuery.dateRange.start || parsedQuery.dateRange.end)) {
      parts.push("filtered by date");
    }

    // Only return if it parsed some specific filters
    if (parsedQuery.intent === "find_any" && !parsedQuery.author && !parsedQuery.dateRange) {
      return null;
    }

    return parts.join(" · ");
  }, [parsedQuery]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-16 pt-10 sm:px-10">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-nexus-muted">Nexus</p>
          <h1 className="text-2xl font-bold text-nexus-text">Find anything. Everywhere. Instantly.</h1>
          <p className="mt-2 text-sm text-nexus-muted">{`Signed in${userName ? ` as ${userName}` : ""}`}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/activity" className="text-xs text-nexus-muted hover:text-nexus-accent font-medium">
            Live Feed
          </Link>
          <span className="text-[#cbd5e1]">|</span>
          <Link href="/dashboard/metrics" className="text-xs text-nexus-muted hover:text-nexus-accent font-medium">
            Analytics
          </Link>
          <span className="text-[#cbd5e1]">|</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShortcutsModalOpen(true)}
            className="h-8 text-xs text-nexus-muted flex items-center gap-1.5"
          >
            <Keyboard className="h-4 w-4" />
            Shortcuts
          </Button>
          <ConnectIndexButton onFinished={() => setRefreshKey((value) => value + 1)} />
        </div>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-nexus-muted" />
        <Input
          ref={inputRef}
          placeholder="Search Gmail, Google Drive, and browser history..."
          className="pl-10 pr-12"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded border border-[#cbd5e1] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-semibold text-nexus-muted shadow-sm select-none">
          ⌘K
        </div>
      </div>

      {/* Structured parsed query explanation */}
      {intentDescription && !loading && (
        <div className="mb-4 flex items-center gap-1.5 text-xs text-[#1252c8] bg-[#ecf3ff] border border-[#cbdcff] rounded-lg px-3 py-2 animate-in fade-in duration-200">
          <Info className="h-3.5 w-3.5" />
          <span>{intentDescription}</span>
        </div>
      )}

      {/* Source pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        <SourceFilterPill label="All" active={activeSource === "ALL"} onClick={() => setActiveSource("ALL")} />
        <SourceFilterPill label="Gmail" active={activeSource === "GMAIL"} onClick={() => setActiveSource("GMAIL")} />
        <SourceFilterPill label="Google Drive" active={activeSource === "DRIVE"} onClick={() => setActiveSource("DRIVE")} />
        <SourceFilterPill label="Web" active={activeSource === "WEB"} onClick={() => setActiveSource("WEB")} />
      </div>

      <div className="mb-5 flex items-center justify-between text-xs text-nexus-muted">
        <span>
          {meta.count > 0 ? `${meta.count} result(s)` : "Start by typing a query"}
          {searchType === "hybrid" && meta.count > 0 && " (Semantic Search Enabled)"}
        </span>
        <span>{meta.tookMs > 0 ? `${meta.tookMs} ms` : ""}</span>
      </div>

      {/* Recently indexed banner (Web history) */}
      {showWebBanner && (
        <div className="mb-6 rounded-xl border border-[#cbdcff] bg-[#ecf3ff] p-4 flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-purple-600 shrink-0" />
            <p className="text-xs font-medium text-[#16469d]">
              Indexed pages from your browsing history are now active! Use natural language to search.
            </p>
          </div>
          <Button onClick={dismissWebBanner} variant="outline" size="sm" className="h-8 text-xs border-[#cbdcff] text-[#16469d] hover:bg-white shrink-0">
            Dismiss
          </Button>
        </div>
      )}

      {loading ? <SearchSkeleton /> : null}

      {error ? (
        <div className="rounded-xl border border-[#f8caca] bg-[#fff5f5] p-4 text-sm text-[#9f1c1c]">{error}</div>
      ) : null}

      {showEmptyState ? (
        <div className="rounded-xl border border-dashed border-nexus-border bg-white/60 p-10 text-center text-sm text-nexus-muted">
          No matches yet. Try narrower keywords, or run Connect & Index to refresh your data.
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <div className="grid gap-4">
          {results.map((item, index) => (
            <div
              key={item.id}
              className="transform transition-all duration-300"
              style={{
                animation: `staggerIn 0.3s ease-out both`,
                animationDelay: `${index * 50}ms`
              }}
            >
              <ResultCard
                item={item}
                query={query}
                index={index}
                isHighlighted={highlightedIndex === index}
              />
            </div>
          ))}
        </div>
      ) : null}

      <KeyboardShortcutsModal isOpen={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />

      {/* Global CSS transition for stagger entries */}
      <style jsx global>{`
        @keyframes staggerIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function SourceFilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide transition-all outline-none ${
        active
          ? "border-[#2563eb] bg-[#2563eb] text-white shadow-sm"
          : "border-[#cbd5e1] bg-white text-[#4a5f86] hover:bg-[#f8fafc]"
      }`}
    >
      {label}
    </button>
  );
}
