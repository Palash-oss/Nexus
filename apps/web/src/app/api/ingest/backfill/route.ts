import { NextResponse } from "next/server";
import { getRequiredServerSession } from "@/lib/auth/session";
import { backfillEmbeddings } from "@/lib/embeddings";

export async function POST() {
  const session = await getRequiredServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Trigger backfill in background
  backfillEmbeddings(session.user.id)
    .then((result) => {
      console.log(`Backfill finished: updated ${result.updated} document(s).`);
    })
    .catch((error) => {
      console.error("Backfill failed:", error);
    });

  return new NextResponse(
    JSON.stringify({
      message: "Backfill process triggered.",
      status: "ACCEPTED",
    }),
    { status: 202 }
  );
}
