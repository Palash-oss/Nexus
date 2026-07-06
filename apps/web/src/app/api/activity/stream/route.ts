import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  };

  let lastChecked = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial keep-alive comment
      controller.enqueue(": open\n\n");

      const interval = setInterval(async () => {
        try {
          const newLogs = await db.ingestLog.findMany({
            where: {
              userId,
              createdAt: { gt: lastChecked },
            },
            orderBy: {
              createdAt: "asc",
            },
          });

          if (newLogs.length > 0) {
            lastChecked = newLogs[newLogs.length - 1].createdAt;
            for (const log of newLogs) {
              controller.enqueue(`data: ${JSON.stringify(log)}\n\n`);
            }
          } else {
            // Keep alive
            controller.enqueue(": ping\n\n");
          }
        } catch (error) {
          console.error("SSE stream polling failed:", error);
          clearInterval(interval);
          controller.error(error);
        }
      }, 2000);

      // Close stream after 5 minutes of inactivity
      const timeout = setTimeout(() => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (_) {}
      }, 5 * 60 * 1000);

      // Listen for client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch (_) {}
      });
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
