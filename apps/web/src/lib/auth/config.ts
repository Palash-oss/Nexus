import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/lib/db";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
].join(" ");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: GOOGLE_SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }

      return session;
    },
    async signIn({ user, account }) {
      if (!user.id || !account || account.provider !== "google") {
        return true;
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: account.access_token,
          googleRefreshToken: account.refresh_token,
          googleAccessTokenExpiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : null,
          googleScope: account.scope,
        },
      });

      return true;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
