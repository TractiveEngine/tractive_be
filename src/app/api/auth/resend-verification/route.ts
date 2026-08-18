// src/app/api/auth/resend-verification/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";
import sendEmail from "@/lib/sendSmtpMail";

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  await dbConnect();
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Don't leak existence
    return NextResponse.json(
      { ok: true, message: "If this email exists, a code will be sent." },
      { status: 200 }
    );
  }

  if (user.isVerified) {
    return NextResponse.json(
      {
        ok: true,
        alreadyVerified: true,
        message: "This account is already verified.",
      },
      { status: 200 }
    );
  }

  const code = genCode();
  user.verificationCode = code;
  user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  let emailSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: "Your verification code",
      template: "register",
      replacements: {
        name: String(user.name ?? ""),
        email: user.email,
        verificationCode: code,
      },
    });
  } catch (error) {
    emailSent = false;
    console.error('Resend verification email failed:', error);
  }

  return NextResponse.json(
    {
      ok: true,
      resent: true,
      emailSent,
      message: emailSent
        ? "Verification code has been successfully resent to your email."
        : "Verification code was refreshed, but the email could not be sent right now.",
    },
    { status: 200 }
  );
}
