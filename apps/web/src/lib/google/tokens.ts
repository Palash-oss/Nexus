import { db } from "@/lib/db";

type UserTokenState = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
};

async function refreshGoogleToken(user: UserTokenState): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: user.refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to refresh Google token: ${errorText}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };

  const expiresAt = new Date(Date.now() + payload.expires_in * 1000 - 60_000);

  await db.user.update({
    where: { id: user.userId },
    data: {
      googleAccessToken: payload.access_token,
      googleAccessTokenExpiresAt: expiresAt,
      googleScope: payload.scope,
    },
  });

  return payload.access_token;
}

export async function getValidGoogleAccessToken(userId: string): Promise<string> {
  let user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleAccessTokenExpiresAt: true,
    },
  });

  // Fallback: If user table does not have OAuth tokens, check the Account table created by NextAuth
  if (!user?.googleAccessToken || !user.googleRefreshToken) {
    const account = await db.account.findFirst({
      where: { userId, provider: "google" },
    });

    if (account?.access_token && account.refresh_token) {
      const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null;
      await db.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: account.access_token,
          googleRefreshToken: account.refresh_token,
          googleAccessTokenExpiresAt: expiresAt,
          googleScope: account.scope,
        },
      });

      user = {
        id: userId,
        googleAccessToken: account.access_token,
        googleRefreshToken: account.refresh_token,
        googleAccessTokenExpiresAt: expiresAt,
      };
    }
  }

  if (!user?.googleAccessToken || !user.googleRefreshToken) {
    throw new Error("Google account is not connected. Sign in again to continue.");
  }

  const tokenState: UserTokenState = {
    userId: user.id,
    accessToken: user.googleAccessToken,
    refreshToken: user.googleRefreshToken,
    expiresAt: user.googleAccessTokenExpiresAt,
  };

  const shouldRefresh =
    !tokenState.expiresAt || tokenState.expiresAt.getTime() <= Date.now() + 30_000;

  if (!shouldRefresh) {
    return tokenState.accessToken;
  }

  return refreshGoogleToken(tokenState);
}
