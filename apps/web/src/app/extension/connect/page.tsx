"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, Key, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function fetchToken() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/extension/token");
      
      if (response.status === 401) {
        // Redirect to signin
        router.push("/signin");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch extension token");
      }

      const data = await response.json();
      setToken(data.token);
      setEmail(data.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("Are you sure you want to regenerate the token? Your existing extension installations will be disconnected.")) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const deleteResponse = await fetch("/api/extension/token", {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        throw new Error("Failed to revoke token");
      }

      // Fetch a new token
      await fetchToken();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  function handleCopy() {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  useEffect(() => {
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f4f7ff] px-6 py-12">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#bfd6ff]/70 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#d4e4ff]/70 blur-3xl" />

      <Card className="w-full max-w-lg p-8">
        <header className="text-center mb-8">
          <div className="inline-flex rounded-full bg-[#eaf1ff] p-3 text-[#1252c8] mb-4">
            <Key className="h-6 w-6" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-nexus-muted">Nexus Chrome Extension</p>
          <h1 className="mt-2 text-2xl font-bold text-nexus-text">Connect Your Extension</h1>
          {email && (
            <p className="mt-1 text-sm text-nexus-muted">Signed in as {email}</p>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-[#1252c8]" />
            <p className="text-sm text-nexus-muted">Fetching connection token...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#f8caca] bg-[#fff5f5] p-4 text-center space-y-4">
            <div className="inline-flex text-[#9f1c1c]"><ShieldAlert className="h-8 w-8" /></div>
            <p className="text-sm text-[#9f1c1c] font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchToken}>Try Again</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-nexus-muted mb-2">
                Your Connection Token
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-2">
                <code className="flex-grow font-mono text-sm overflow-x-auto select-all px-2 text-[#0f234c]">
                  {token}
                </code>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-9 w-9 shrink-0">
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-nexus-muted" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e9fb] bg-[#f8faff] p-4 text-sm text-[#3f4f72] space-y-3">
              <p className="font-semibold text-[#0b1838]">Setup Instructions:</p>
              <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed">
                <li>Copy the connection token shown above.</li>
                <li>Open the Nexus extension popup from your Chrome browser toolbar.</li>
                <li>Paste the copied token into the text input box.</li>
                <li>Click <strong>Save Token</strong> to connect your browser history indexing.</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={() => router.push("/")} variant="outline" className="flex-1">
                Back to Search
              </Button>
              <Button onClick={handleRegenerate} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate Token
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
