import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";
import { compare, hash } from "bcryptjs";
import { verifyToken } from "@/lib/auth";

function getBearerToken(req: Request): string | null {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

// Optional: simple password policy check
function isStrong(pw: string) {
  return typeof pw === "string" && pw.length >= 8;
  // extend: at least 1 number/symbol/uppercase etc.
}

export async function POST(req: Request) {
  await dbConnect();

  const token = getBearerToken(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password required" },
      { status: 400 }
    );
  }

  if (!isStrong(newPassword)) {
    return NextResponse.json(
      { error: "New password does not meet policy (min 8 chars)" },
      { status: 400 }
    );
  }

  const user = await User.findById(payload.userId);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await compare(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid current password" },
      { status: 400 }
    );
  }

  user.password = await hash(newPassword, 10);
  await user.save();

  return NextResponse.json(
    { ok: true, message: "Password updated" },
    { status: 200 }
  );
}
