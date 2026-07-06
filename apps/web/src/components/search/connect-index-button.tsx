"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type IngestionResult = {
  ok: boolean;
  error?: string;
};

export function ConnectIndexButton({ onFinished }: { onFinished: () => void }) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setStatusText("Connecting sources...");

    const phaseTimer = setTimeout(() => setStatusText("Indexing Gmail and Drive..."), 900);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
      });
      const payload = (await response.json()) as IngestionResult;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Ingestion failed.");
      }

      setStatusText("Index complete.");
      onFinished();
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      clearTimeout(phaseTimer);
      setLoading(false);
      setTimeout(() => setStatusText(null), 3000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {statusText ? <p className="text-xs text-nexus-muted">{statusText}</p> : null}
      <Button onClick={handleRun} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Indexing
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Connect & Index
          </>
        )}
      </Button>
    </div>
  );
}
