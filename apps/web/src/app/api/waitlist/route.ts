import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

import { db } from "@/lib/db";

const waitlistSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = waitlistSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Check if already in waitlist
    const existing = await db.waitlist.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
      });
    }

    // Save to DB
    await db.waitlist.create({
      data: {
        email,
        source: "landing",
      },
    });

    // Send confirmation email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Nexus <hello@nexus.app>",
          to: email,
          subject: "You're on the Nexus waitlist 🎉",
          text: `Hi there,\n\nThanks for signing up! You're officially on the waitlist for Nexus.\n\nNexus is a universal search layer that searches your Gmail, Google Drive, and browser history all in one place.\n\nWe'll reach out as soon as early access opens up for your account!\n\nBest,\nThe Nexus Team`,
        });
      } catch (err) {
        console.error("Resend email delivery failed:", err);
        // Do not crash the API, email is nice-to-have
      }
    } else {
      console.warn("RESEND_API_KEY is not configured. Skipping confirmation email.");
    }

    return NextResponse.json({
      success: true,
      alreadyJoined: false,
    });
  } catch (error) {
    console.error("Waitlist submission failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
