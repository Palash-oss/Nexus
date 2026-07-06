import { ingestDriveForUser } from "@/lib/ingestion/drive";
import { ingestGmailForUser } from "@/lib/ingestion/gmail";

export async function runIngestion(userId: string) {
  const [gmail, drive] = await Promise.allSettled([
    ingestGmailForUser(userId),
    ingestDriveForUser(userId),
  ]);

  return {
    gmail,
    drive,
  };
}
