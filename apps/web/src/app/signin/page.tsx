import { redirect } from "next/navigation";

import { SignInButton } from "@/components/search/sign-in-button";
import { getRequiredServerSession } from "@/lib/auth/session";

export default async function SignInPage() {
  const session = await getRequiredServerSession();

  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-nexus-border bg-white p-8 text-center shadow-[0_15px_50px_-30px_rgba(7,20,47,0.5)]">
        <p className="text-xs uppercase tracking-[0.2em] text-nexus-muted">Nexus</p>
        <h1 className="mt-3 text-2xl font-semibold text-nexus-text">Find anything. Everywhere. Instantly.</h1>
        <p className="mb-7 mt-3 text-sm text-nexus-muted">
          Connect Google once. Search Gmail and Drive from one place.
        </p>
        <SignInButton />
      </div>
    </main>
  );
}
