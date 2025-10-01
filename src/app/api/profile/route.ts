// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";
import { verifyToken } from "@/lib/auth";
import { z } from "zod";

// Pull Bearer token from headers
function getBearerToken(req: Request): string | null {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

// Allowed roles (align with your Mongoose schema)
const ROLE_ENUM = ["buyer", "agent", "transporter", "admin"] as const;
type Role = (typeof ROLE_ENUM)[number];

// Only allow these fields to be updated via PATCH (typed)
const ProfileUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    lga: z.string().optional(),
    villageOrLocalMarket: z.string().optional(),
    businessName: z.string().optional(),
    businessCAC: z.string().optional(),
    interests: z.array(z.string()).optional(),
    activeRole: z.enum(ROLE_ENUM).optional(),
  })
  .strict(); // disallow unknown keys

type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export async function GET(req: Request) {
  await dbConnect();
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await User.findById(payload.userId)
    .select(
      "-password -resetPasswordToken -resetPasswordTokenExpiry -verificationCode"
    )
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ user }, { status: 200 });
}

export async function PATCH(req: Request) {
  await dbConnect();
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse & validate body; unknown keys rejected
  const raw: unknown = await req.json().catch(() => ({}));
  const parsed = ProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const updates: ProfileUpdate = parsed.data;

  // Enforce role-switch safety (only to an already-owned role)
  if (updates.activeRole) {
    const current = await User.findById(payload.userId)
      .select("roles")
      .lean<{ roles: Role[] }>();

    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!current.roles?.includes(updates.activeRole)) {
      return NextResponse.json(
        { error: "Cannot activate a role you don't have" },
        { status: 403 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided" },
      { status: 400 }
    );
  }

  const user = await User.findByIdAndUpdate(
    payload.userId,
    { $set: updates },
    { new: true }
  ).select(
    "-password -resetPasswordToken -resetPasswordTokenExpiry -verificationCode"
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    { user, message: "Profile updated" },
    { status: 200 }
  );
}
