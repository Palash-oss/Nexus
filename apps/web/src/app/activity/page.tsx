"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Folder, Globe, Activity, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ActivityItem = {
  id: string;
  source: "GMAIL" | "DRIVE" | "WEB";
  count: number;
  createdAt: string;
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch historical activity logs first
    async function fetchHistory() {
      try {
        const res = await fetch("/api/activity/history");
        if (res.ok) {
          const data = await res.json();
          setItems(data.history || []);
        }
      } catch (err) {
        console.error("Failed to load activity history:", err);
      }
    }

    fetchHistory();

    // Connect to Server-Sent Events stream
    const eventSource = new EventSource("/api/activity/stream");

    eventSource.onopen = () => {
      setStatus("connected");
    };

    eventSource.onerror = () => {
      setStatus("disconnected");
    };

    eventSource.onmessage = (event) => {
      try {
        const newItem = JSON.parse(event.data) as ActivityItem;
        setItems((prev) => {
          // Prevent duplicates
          if (prev.some((item) => item.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
      } catch (err) {
        // Silently skip non-json keep-alive pings
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Auto-scroll to bottom of activity feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  function getSourceIcon(source: ActivityItem["source"]) {
    switch (source) {
      case "GMAIL":
        return <Mail className="h-5 w-5 text-red-600" />;
      case "DRIVE":
        return <Folder className="h-5 w-5 text-blue-600" />;
      case "WEB":
        return <Globe className="h-5 w-5 text-purple-600" />;
    }
  }

  function getSourceLabel(source: ActivityItem["source"]) {
    switch (source) {
      case "GMAIL":
        return "emails from Gmail";
      case "DRIVE":
        return "files from Drive";
      case "WEB":
        return "pages from browsing history";
    }
  }

  return (
    <main className="relative min-h-screen bg-[#f4f7ff] px-6 pb-20 pt-10 sm:px-10">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#bfd6ff]/70 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#d4e4ff]/70 blur-3xl" />

      <section className="relative mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5 text-nexus-muted" />
              </Button>
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-nexus-muted">System Logs</p>
              <h1 className="text-2xl font-bold text-nexus-text">Live Ingestion Activity</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${
              status === "connected" ? "bg-green-500 animate-pulse" : status === "connecting" ? "bg-yellow-500" : "bg-red-500"
            }`} />
            <span className="text-xs text-nexus-muted capitalize">{status}</span>
          </div>
        </header>

        <Card className="p-6 min-h-[450px] flex flex-col">
          <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4 mb-4">
            <Activity className="h-5 w-5 text-[#1252c8]" />
            <h2 className="text-sm font-semibold text-nexus-text">Real-Time Event Stream</h2>
          </div>

          {items.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-12">
              <RefreshCw className="h-10 w-10 text-nexus-muted animate-spin mb-4" />
              <p className="text-sm font-medium text-nexus-text">Waiting for activity...</p>
              <p className="text-xs text-nexus-muted mt-1">Start browsing pages or trigger Gmail/Drive sync to see logs feed in live.</p>
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto max-h-[500px] space-y-4 pr-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 rounded-xl border border-[#e2e9fb] bg-[#f8faff] p-4 shadow-sm transition-all hover:bg-white"
                >
                  <div className="rounded-lg bg-white p-2.5 shadow-sm border border-[#e2e9fb]">
                    {getSourceIcon(item.source)}
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium text-nexus-text">
                      Indexed <span className="font-semibold text-[#0b1838]">{item.count}</span> {getSourceLabel(item.source)}
                    </p>
                    <p className="text-xs text-nexus-muted mt-1">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
