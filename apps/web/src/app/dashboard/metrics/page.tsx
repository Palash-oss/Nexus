import { getRequiredServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isAnthropicConfigured } from "@/lib/queryParser";
import { isOpenAiConfigured } from "@/lib/embeddings";
import { ArrowLeft, Database, Search, Cpu, Globe, Server, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const session = await getRequiredServerSession();
  const userId = session?.user?.id;

  if (!userId) {
    return <div className="p-10 text-center">Unauthorized</div>;
  }

  // 1. Index Health Queries
  const docsCount = await db.document.groupBy({
    by: ["source"],
    where: { userId },
    _count: { id: true },
  });

  const totalDocs = docsCount.reduce((acc, curr) => acc + curr._count.id, 0);

  const webDocs = docsCount.find(d => d.source === "WEB")?._count.id || 0;
  const gmailDocs = docsCount.find(d => d.source === "GMAIL")?._count.id || 0;
  const driveDocs = docsCount.find(d => d.source === "DRIVE")?._count.id || 0;

  // Embedding coverage: Count docs where embeddingVector is not null/empty
  const docsWithEmbedding = await db.document.count({
    where: {
      userId,
      NOT: {
        embeddingVector: { equals: [] }
      }
    }
  });

  const embeddingCoverage = totalDocs > 0 ? Math.round((docsWithEmbedding / totalDocs) * 100) : 0;

  // Last Ingestion runs
  const lastIngests = await db.ingestionRun.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 3,
  });

  // 2. Search Performance Queries
  const searchLogs = await db.searchLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalSearches = searchLogs.length;

  // Calculate latencies
  const latencies = searchLogs.map(l => l.durationMs).sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.50)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

  // 3. Top Searches
  const topQueriesRaw = await db.$queryRaw<{ query: string; count: number }[]>`
    SELECT query, COUNT(*)::int as count
    FROM "SearchLog"
    WHERE "userId" = ${userId}
    GROUP BY query
    ORDER BY count DESC
    LIMIT 5
  `;

  // Zero result queries
  const zeroResultQueries = await db.searchLog.findMany({
    where: { userId, resultCount: 0 },
    select: { query: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 4. Extension Ingest Info
  const lastExtToken = await db.extensionToken.findFirst({
    where: { userId },
    orderBy: { lastUsed: "desc" },
  });

  const lastExtSyncStr = lastExtToken?.lastUsed 
    ? new Date(lastExtToken.lastUsed).toLocaleTimeString() 
    : "Never";

  // Check API keys status
  const openaiStatus = isOpenAiConfigured() ? "Online" : "Offline";
  const claudeStatus = isAnthropicConfigured() ? "Online" : "Offline";

  return (
    <main className="relative min-h-screen bg-[#f4f7ff] px-6 pb-20 pt-10 sm:px-10">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#bfd6ff]/70 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#d4e4ff]/70 blur-3xl" />

      <section className="relative mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5 text-nexus-muted" />
              </Button>
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-nexus-muted">Analytics</p>
              <h1 className="text-2xl font-bold text-nexus-text">System Metrics Dashboard</h1>
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Panel 1: Search Performance */}
          <Card className="p-6">
            <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4 mb-4">
              <Search className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-nexus-text">Search Performance</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-[#f8faff] p-3 text-center border border-[#e2e9fb]">
                <p className="text-xs text-nexus-muted uppercase font-semibold">P50 Latency</p>
                <p className="text-lg font-bold text-[#0b1838] mt-1">{p50} ms</p>
              </div>
              <div className="rounded-lg bg-[#f8faff] p-3 text-center border border-[#e2e9fb]">
                <p className="text-xs text-nexus-muted uppercase font-semibold">P95 Latency</p>
                <p className="text-lg font-bold text-[#0b1838] mt-1">{p95} ms</p>
              </div>
              <div className="rounded-lg bg-[#f8faff] p-3 text-center border border-[#e2e9fb]">
                <p className="text-xs text-nexus-muted uppercase font-semibold">P99 Latency</p>
                <p className="text-lg font-bold text-[#0b1838] mt-1">{p99} ms</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold py-1 text-nexus-muted border-b border-[#f1f5f9]">
                <span>Top Search Queries</span>
                <span>Count</span>
              </div>
              {topQueriesRaw.length === 0 ? (
                <p className="text-xs text-nexus-muted text-center py-4">No query logs recorded yet.</p>
              ) : (
                topQueriesRaw.map((q, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 text-[#3f4f72]">
                    <span className="font-mono">&quot;{q.query}&quot;</span>
                    <span className="font-semibold">{q.count}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Panel 2: Index Health */}
          <Card className="p-6">
            <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4 mb-4">
              <Database className="h-5 w-5 text-purple-600" />
              <h2 className="text-sm font-semibold text-nexus-text">Index & Document Health</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg bg-[#f8faff] p-3 border border-[#e2e9fb] text-center">
                <p className="text-xs text-nexus-muted uppercase font-semibold">Total Documents</p>
                <p className="text-xl font-bold text-[#0b1838] mt-1">{totalDocs}</p>
              </div>
              <div className="rounded-lg bg-[#f8faff] p-3 border border-[#e2e9fb] text-center">
                <p className="text-xs text-nexus-muted uppercase font-semibold">Embedding Coverage</p>
                <p className="text-xl font-bold text-[#0b1838] mt-1">{embeddingCoverage}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold py-1 text-nexus-muted border-b border-[#f1f5f9]">
                <span>Document Source</span>
                <span>Count</span>
              </div>
              <div className="flex justify-between text-xs py-1 text-[#3f4f72]">
                <span>📧 Gmail Inboxes</span>
                <span className="font-semibold">{gmailDocs}</span>
              </div>
              <div className="flex justify-between text-xs py-1 text-[#3f4f72]">
                <span>📁 Google Drive Files</span>
                <span className="font-semibold">{driveDocs}</span>
              </div>
              <div className="flex justify-between text-xs py-1 text-[#3f4f72]">
                <span>🌐 Chrome Extension Web History</span>
                <span className="font-semibold">{webDocs}</span>
              </div>
            </div>
          </Card>

          {/* Panel 3: System Status & API Keys */}
          <Card className="p-6">
            <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4 mb-4">
              <Cpu className="h-5 w-5 text-amber-600" />
              <h2 className="text-sm font-semibold text-nexus-text">System Status</h2>
            </div>

            <div className="space-y-4">
              <StatusRow icon={<Server className="h-4 w-4" />} label="PostgreSQL DB" value="Connected" ok={true} />
              <StatusRow icon={<CheckCircle2 className="h-4 w-4" />} label="OpenAI API (Embeddings)" value={openaiStatus} ok={openaiStatus === "Online"} />
              <StatusRow icon={<CheckCircle2 className="h-4 w-4" />} label="Anthropic API (Claude)" value={claudeStatus} ok={claudeStatus === "Online"} />
              <StatusRow icon={<Globe className="h-4 w-4" />} label="Chrome Extension Sync" value={`Last sync: ${lastExtSyncStr}`} ok={!!lastExtToken} />
            </div>
          </Card>

          {/* Panel 4: Zero-Result Queries */}
          <Card className="p-6">
            <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4 mb-4">
              <Cpu className="h-5 w-5 text-red-600" />
              <h2 className="text-sm font-semibold text-nexus-text">Zero-Result Queries (Misses)</h2>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold py-1 text-nexus-muted border-b border-[#f1f5f9]">
                <span>Missed Query Term</span>
                <span>Logged At</span>
              </div>
              {zeroResultQueries.length === 0 ? (
                <p className="text-xs text-nexus-muted text-center py-4">No zero-result searches logged.</p>
              ) : (
                zeroResultQueries.map((zq, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 text-[#3f4f72]">
                    <span className="font-mono">&quot;{zq.query}&quot;</span>
                    <span>{new Date(zq.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function StatusRow({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded bg-[#f1f5f9] ${ok ? "text-green-600" : "text-nexus-muted"}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-[#4a5f86]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-xs font-semibold text-[#0f234c]">{value}</span>
      </div>
    </div>
  );
}
