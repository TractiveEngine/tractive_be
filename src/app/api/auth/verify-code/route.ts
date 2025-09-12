// src/app/api/auth/verify/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";

export async function POST(request: Request) {
  await dbConnect();
  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code required" },
      { status: 400 }
    );
  }

  const user = await User.findOne({ email });
  // Idempotent: if already verified, return 200
  if (!user) {
    // Do not disclose user existence
    await new Promise((r) => setTimeout(r, 150)); // tiny delay to avoid oracle timing
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (user.isVerified) {
    return NextResponse.json({ ok: true, verified: true }, { status: 200 });
  }

  const expired =
    !user.verificationTokenExpiry ||
    new Date(user.verificationTokenExpiry).getTime() < Date.now();

  const match = (user.verificationCode ?? "").trim() === String(code).trim();

  if (!match || expired) {
    return NextResponse.json(
      { error: expired ? "Code expired" : "Invalid verification code" },
      { status: 400 }
    );
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationTokenExpiry = undefined;
  await user.save();

  return NextResponse.json({ ok: true, verified: true }, { status: 200 });
}
