import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth/config";

// GET: Returns current user's extension token (creates one if none exists)
// Or, if authenticated via Bearer token, returns { token, email } to verify
export async function GET(request: NextRequest) {
  // Check Bearer Token first (used by popup to fetch user email)
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const tokenVal = authHeader.substring(7).trim();
    const extToken = await db.extensionToken.findUnique({
      where: { token: tokenVal },
      include: { user: true },
    });

    if (extToken) {
      return NextResponse.json({
        token: extToken.token,
        email: extToken.user.email,
      });
    }
  }

  // Fallback to NextAuth session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let extToken = await db.extensionToken.findFirst({
    where: { userId },
  });

  if (!extToken) {
    extToken = await db.extensionToken.create({
      data: {
        userId,
      },
    });
  }

  return NextResponse.json({
    token: extToken.token,
    email: session.user.email,
  });
}

// DELETE: Revokes current extension token
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.extensionToken.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ success: true, message: "Token revoked" });
}
