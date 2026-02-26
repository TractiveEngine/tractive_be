import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";
import { signRefreshToken, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  await dbConnect();
  const { email, password } = await request.json();

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.isVerified) {
    return NextResponse.json(
      { error: "Please verify your email before logging in." },
      { status: 403 }
    );
  }

  const tokenVersion = user.tokenVersion ?? 0;
  const token = signToken({ userId: user._id, email: user.email, tokenVersion });
  const refreshToken = signRefreshToken({ userId: user._id, email: user.email, tokenVersion });
  user.refreshToken = refreshToken;
  user.refreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();

  const response = NextResponse.json({ 
    token,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      activeRole: user.activeRole
    }
  }, { status: 200 });

  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60
  });

  return response;
}
