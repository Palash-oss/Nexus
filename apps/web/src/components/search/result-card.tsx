import { format } from "date-fns";
import { Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SearchResultItem } from "@/types/search";

function sourceClass(source: SearchResultItem["source"]) {
  if (source === "GMAIL") {
    return "border-[#fad2d2] bg-[#fff3f3] text-[#b42318]";
  }
  if (source === "DRIVE") {
    return "border-[#bfdcff] bg-[#eef5ff] text-[#1850b4]";
  }
  return "border-[#d8b4fe] bg-[#f3e8ff] text-[#701a75]"; // Purple for WEB
}

function leftStripClass(score: number) {
  if (score === 3) return "bg-[#eab308]"; // Gold
  if (score === 2) return "bg-[#a855f7]"; // Purple
  return "bg-[#3b82f6]"; // Blue
}

function highlight(text: string, query: string) {
  if (!query.trim()) {
    return text;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "i");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    pattern.exec(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-[#cae0ff] px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function ResultCard({
  item,
  query,
  index,
  isHighlighted = false,
}: {
  item: SearchResultItem;
  query: string;
  index: number;
  isHighlighted?: boolean;
}) {
  const domain = item.source === "WEB" ? (item.author || new URL(item.url).hostname) : null;
  const showAiSummary = item.aiSummary && index < 3;

  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="block outline-none">
      <Card
        className={`group relative overflow-hidden pl-7 pr-5 py-5 transition-all duration-200 hover:-translate-y-0.5 ${
          isHighlighted ? "border-[#2563eb] bg-[#f8fafc] ring-2 ring-[#2563eb]/20" : "hover:border-[#cbd5e1]"
        }`}
      >
        {/* Left strip relevance indicator */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${leftStripClass(item.score)}`} />

        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge className={sourceClass(item.source)}>{item.source}</Badge>
            {item.source === "WEB" && domain && (
              <div className="flex items-center gap-1.5 text-xs text-[#4a5f86]">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <Globe2 className="h-3 w-3 text-nexus-muted inline-block" />
                <span className="font-medium">{domain}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-nexus-muted">
            {item.date ? format(new Date(item.date), "MMM d, yyyy") : "No date"}
          </p>
        </div>

        <h3 className={`mb-2 line-clamp-1 text-base font-semibold transition-colors ${
          isHighlighted ? "text-[#2563eb]" : "text-nexus-text group-hover:text-nexus-accent"
        }`}>
          {highlight(item.title, query)}
        </h3>

        <p className="mb-3 line-clamp-3 text-sm leading-6 text-nexus-muted">
          {highlight(item.snippet || "No preview available.", query)}
        </p>

        {/* AI summary badge and explanation */}
        {showAiSummary && (
          <div className="mb-3 rounded-lg border border-[#e2e9fb] bg-[#f8faff] p-3 text-xs leading-relaxed text-[#3f4f72]">
            <span className="inline-flex items-center gap-1 rounded bg-[#ecf3ff] px-1.5 py-0.5 font-semibold text-[#1252c8] mr-2">
              ✦ AI Summary
            </span>
            <span className="italic">{item.aiSummary}</span>
          </div>
        )}

        <p className="text-xs text-nexus-muted">
          {item.source === "WEB" ? domain : (item.author ?? "Unknown author")}
        </p>
      </Card>
    </a>
  );
}
