import { Search, Mail, Folder, Globe, ArrowRight, ArrowDown, HelpCircle, Shield, Sparkles, Network, Cpu } from "lucide-react";
import Link from "next/link";

import { SignInButton } from "@/components/search/sign-in-button";
import { SearchShell } from "@/components/search/search-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRequiredServerSession } from "@/lib/auth/session";
import { WaitlistForm } from "@/components/landing/waitlist-form";

export default async function Home() {
  const session = await getRequiredServerSession();

  if (session?.user?.id) {
    return <SearchShell userName={session.user.name} />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900 font-sans selection:bg-[#cae0ff]">
      {/* Subtle top gradients */}
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#bfd6ff]/50 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#d4e4ff]/50 blur-3xl" />

      {/* SECTION 1 — Header & Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-8 pb-16 sm:px-10">
        <header className="mb-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-wider text-[#1252c8]">NEXUS</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/signin">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <a href="#waitlist">
              <Button className="bg-[#2563eb] hover:bg-[#1d4ed8]">Get Early Access</Button>
            </a>
          </div>
        </header>

        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="inline-flex items-center rounded-full border border-[#cbdcff] bg-[#ecf3ff] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#16469d] mb-6">
            Introducing Nexus 1.0
          </p>
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight text-[#0b1838] tracking-tight">
            Find anything. <br className="sm:hidden" />
            <span className="text-[#2563eb]">In seconds.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#3f4f72] max-w-2xl mx-auto font-medium">
            Nexus searches your Gmail, Google Drive, and browser history in one place — instantly. Connect once, search automatically, and find what you need.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="#waitlist">
              <Button size="lg" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold">
                Get Early Access
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-[#cbd5e1] hover:bg-slate-50 font-semibold">
              Add to Chrome
            </Button>
          </div>
        </div>

        {/* Realistic Interactive Search Mock */}
        <div className="mx-auto max-w-4xl rounded-2xl border border-[#cbd8f4] bg-white/95 p-6 shadow-[0_25px_80px_-40px_rgba(7,20,47,0.45)]">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-nexus-muted" />
            <div className="w-full rounded-lg border border-[#cbd5e1] bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-left text-nexus-muted select-none flex items-center justify-between">
              <span>&quot;that proposal from last month&quot;</span>
              <kbd className="rounded border border-[#cbd5e1] bg-white px-1.5 py-0.5 text-[10px] font-semibold">Ctrl+K</kbd>
            </div>
          </div>

          <div className="space-y-3">
            <MockResultCard
              source="GMAIL"
              title="Re: Q3 Strategy Proposal & Budget Details"
              snippet="Here is the project proposal draft we discussed. Please review the budget outlines before tomorrow..."
              author="Rahul Sharma (rahul@company.com)"
              date="Nov 14, 2026"
            />
            <MockResultCard
              source="DRIVE"
              title="Q3 Strategy Proposal Final Draft"
              snippet="Comprehensive marketing budget outlines, roadmap schedules, and resource planning spreadsheets for Q3..."
              author="Shared folder"
              date="Nov 15, 2026"
            />
            <MockResultCard
              source="WEB"
              title="How to Write a Winning Business Proposal — Guide"
              snippet="A step by step walkthrough on structuring budget outlines, strategy pitches, and value propositions..."
              author="hbr.org/business-proposal"
              date="Nov 18, 2026"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2 — Problem Statement */}
      <section className="bg-slate-50 py-20 px-6 sm:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold text-[#0b1838]">Finding information across tabs is broken.</h2>
          <p className="mt-4 text-base text-[#3f4f72]">How much time do you waste switching interfaces just to find a simple link?</p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <ProblemCard
              icon={<Mail className="h-6 w-6 text-red-600" />}
              title="You search Gmail..."
              desc="Digging through inboxes, trying to remember who sent that document."
            />
            <ProblemCard
              icon={<Folder className="h-6 w-6 text-blue-600" />}
              title="...then Google Drive..."
              desc="Hunting folder trees and filenames hoping the keywords match."
            />
            <ProblemCard
              icon={<Globe className="h-6 w-6 text-purple-600" />}
              title="...then your history tabs."
              desc="Scanning hundreds of random page titles in your browser history list."
            />
          </div>
          
          <p className="mt-12 text-lg font-bold text-[#2563eb]">There has to be a better way.</p>
        </div>
      </section>

      {/* SECTION 3 — How It Works */}
      <section className="py-24 px-6 sm:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold text-[#0b1838]">How Nexus works</h2>
          <p className="mt-3 text-base text-nexus-muted">Connect your apps and start searching in under a minute.</p>

          <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4">
            <StepCard number={1} title="Connect your apps" desc="Link Google Drive & Gmail in 30 seconds." />
            <ArrowRight className="hidden md:block h-6 w-6 text-[#cbd5e1]" />
            <ArrowDown className="md:hidden h-6 w-6 text-[#cbd5e1]" />
            <StepCard number={2} title="Install extension" desc="Add the Manifest V3 Chrome Extension." />
            <ArrowRight className="hidden md:block h-6 w-6 text-[#cbd5e1]" />
            <ArrowDown className="md:hidden h-6 w-6 text-[#cbd5e1]" />
            <StepCard number={3} title="Search in one bar" desc="Use natural query commands everywhere." />
          </div>
        </div>
      </section>

      {/* SECTION 4 — Features */}
      <section className="bg-slate-50 py-24 px-6 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0b1838]">Built with real technical depth</h2>
            <p className="mt-3 text-base text-nexus-muted">Nexus is optimized for instant lookup speed and intelligent parsing.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <FeatureItem
              icon={<Sparkles className="h-5 w-5 text-blue-600" />}
              title="Semantic hybrid search"
              desc="Finds what you mean, not just what you typed. Combines raw pgvector cosine calculations with reciprocal rank fusion (RRF)."
            />
            <FeatureItem
              icon={<Cpu className="h-5 w-5 text-purple-600" />}
              title="Claude-generated summaries"
              desc="Explains why each result matches your search. Under the top results, a single-sentence relevance callout displays immediately."
            />
            <FeatureItem
              icon={<Globe className="h-5 w-5 text-amber-600" />}
              title="Real-time browser history syncing"
              desc="The background service worker watches your tabs, extracts content using a custom Readability parser, and indexes it silently."
            />
            <FeatureItem
              icon={<Shield className="h-5 w-5 text-green-600" />}
              title="Enterprise-grade privacy"
              desc="Your data is strictly bound to your account. Sensitive domains (banking, auth endpoints, social media) are filtered by blocklist."
            />
          </div>
        </div>
      </section>

      {/* SECTION 5 — Waitlist Form */}
      <section id="waitlist" className="py-24 px-6 sm:px-10 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold text-[#0b1838]">Request Early Access</h2>
          <p className="mt-4 mb-8 text-[#3f4f72]">
            Nexus is currently running in a closed developer preview. Enter your email below to reserve your spot on the waitlist.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* SECTION 6 — Footer */}
      <footer className="border-t border-slate-100 py-12 px-6 sm:px-10 bg-slate-50 text-xs text-nexus-muted">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-bold text-sm tracking-wider text-[#1252c8]">NEXUS</span>
            <p className="mt-1.5">Universal knowledge indexing and search layer.</p>
          </div>

          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-900">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900">Terms of Service</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-slate-900">GitHub</a>
          </div>
        </div>
        <div className="mx-auto max-w-5xl text-center mt-8 pt-6 border-t border-slate-200">
          Built with Next.js, pgvector, and Claude AI. All rights reserved.
        </div>
      </footer>
    </main>
  );
}

function MockResultCard({ source, title, snippet, author, date }: { source: "GMAIL" | "DRIVE" | "WEB"; title: string; snippet: string; author: string; date: string }) {
  const badgeClass =
    source === "GMAIL"
      ? "border-[#fad2d2] bg-[#fff3f3] text-[#b42318]"
      : source === "DRIVE"
      ? "border-[#bfdcff] bg-[#eef5ff] text-[#1850b4]"
      : "border-[#d8b4fe] bg-[#f3e8ff] text-[#701a75]";

  return (
    <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-4 text-left shadow-sm">
      <div className="flex justify-between items-center gap-2 mb-2">
        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {source}
        </span>
        <span className="text-[10px] text-nexus-muted">{date}</span>
      </div>
      <h4 className="text-sm font-semibold text-[#0f234c]">{title}</h4>
      <p className="text-xs text-nexus-muted mt-1 leading-normal">{snippet}</p>
      <p className="text-[10px] text-nexus-muted mt-2 font-medium">{author}</p>
    </div>
  );
}

function ProblemCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-6 text-center">
      <div className="mx-auto mb-4 inline-flex rounded-lg bg-slate-50 p-3">{icon}</div>
      <h3 className="text-sm font-bold text-[#0b1838]">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-[#4a5f86]">{desc}</p>
    </div>
  );
}

function StepCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-150 bg-[#f8faff] px-6 py-8 text-center max-w-[220px] w-full">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-xs font-bold text-white mb-4">
        {number}
      </span>
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b1838]">{title}</h3>
      <p className="mt-2 text-2xs leading-relaxed text-nexus-muted">{desc}</p>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="rounded-lg bg-white p-2 border border-slate-200/50 shadow-sm shrink-0 self-start">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-[#0f234c]">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#4a5f86]">{desc}</p>
      </div>
    </div>
  );
}
