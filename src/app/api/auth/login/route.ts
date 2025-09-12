import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

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

  const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: "1h",
  });

  return NextResponse.json({ token }, { status: 200 });
}
