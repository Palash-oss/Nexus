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

      const gmailStatus = payload.gmail?.status === "fulfilled" ? payload.gmail.value.status : "FAILED";
      const driveStatus = payload.drive?.status === "fulfilled" ? payload.drive.value.status : "FAILED";

      if (gmailStatus === "FAILED" || driveStatus === "FAILED") {
        setStatusText(`Index partial: Gmail: ${gmailStatus}, Drive: ${driveStatus}`);
      } else {
        setStatusText("Index complete.");
      }
      onFinished();
      setTimeout(() => setStatusText(null), 5000);
    } catch (error) {
      setStatusText((error as Error).message);
      setTimeout(() => setStatusText(null), 15000);
    } finally {
      clearTimeout(phaseTimer);
      setLoading(false);
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
