# Deployment Guide — Nexus

This document explains the steps to deploy Nexus to Vercel (frontend Next.js) and Railway (PostgreSQL database).

---

## 1. Database Deployment (Railway)

1. Provision a **PostgreSQL** instance on [Railway](https://railway.app/).
2. Run database migration and execute the manual SQL setup script to enable vector math helper functions:
   ```bash
   # Run local shell script to initialize PostgreSQL and sync schema
   sh scripts/setup-db.sh
   ```
3. Copy the database connection URL from the Railway console dashboard (`DATABASE_URL`).

---

## 2. Next.js Deployment (Vercel)

1. Create a new project in [Vercel](https://vercel.com/) linked to your repository.
2. In the project settings, configure the following Environment Variables:
   * `DATABASE_URL`: Your Railway database URL.
   * `NEXTAUTH_URL`: Your production URL (e.g., `https://nexus.app`).
   * `NEXTAUTH_SECRET`: Generate a random signing key (`openssl rand -base64 32`).
   * `GOOGLE_CLIENT_ID`: Your Google OAuth credentials ID.
   * `GOOGLE_CLIENT_SECRET`: Your Google OAuth secret.
   * `OPENAI_API_KEY`: API key for embeddings generation.
   * `ANTHROPIC_API_KEY`: API key for Claude query parsing and summaries.
3. Configure the `vercel.json` config file at the repository root:
   ```json
   {
     "buildCommand": "npx prisma generate && npm run build"
   }
   ```
4. Deploy the project.

---

## 3. Google OAuth Configuration

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services > Credentials**.
3. Under **OAuth 2.0 Client IDs**, edit your client credential or create a new one.
4. Add your production deployment domain URL to **Authorized JavaScript origins**.
5. Add the callback URL: `https://<YOUR-PRODUCTION-DOMAIN>.vercel.app/api/auth/callback/google` to **Authorized redirect URIs**.
6. Save changes.
