import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/config";

export function getRequiredServerSession() {
  return getServerSession(authOptions);
}
