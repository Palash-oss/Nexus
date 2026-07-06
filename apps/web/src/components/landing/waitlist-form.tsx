"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Submission failed");
      }

      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm font-semibold text-green-800">
        You&apos;re on the list! We&apos;ll be in touch. 🎉
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <Input
          type="email"
          placeholder="Enter your work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-grow bg-white border-[#cbd5e1] text-nexus-text placeholder-slate-400"
        />
        <Button type="submit" disabled={loading} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
          {loading ? "Joining..." : "Request Access"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 font-semibold text-center">{error}</p>
      )}
    </form>
  );
}
