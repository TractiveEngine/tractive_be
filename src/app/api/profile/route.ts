import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user";
import { verifyToken } from "@/lib/auth";

// Pull Bearer token from headers
function getBearerToken(req: Request): string | null {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

// Only allow these fields to be updated via PATCH
const ALLOWED_UPDATE_FIELDS = new Set([
  "name",
  "phone",
  "address",
  "country",
  "state",
  "lga",
  "villageOrLocalMarket",
  "businessName",
  "businessCAC",
  "interests", // array of strings
  "activeRole", // if you let the user switch (and they already have that role)
]);

function pickAllowed(body: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_UPDATE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

export async function GET(req: Request) {
  await dbConnect();
  const token = getBearerToken(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await User.findById(payload.userId)
    .select(
      "-password -resetPasswordToken -resetPasswordTokenExpiry -verificationCode"
    )
    .lean();

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user }, { status: 200 });
}

export async function PATCH(req: Request) {
  await dbConnect();
  const token = getBearerToken(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates = pickAllowed(body);

  // Optional Zod validation
  // const parsed = ProfileUpdateSchema.safeParse(updates);
  // if (!parsed.success) {
  //   return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // }

  // Enforce role-switch safety (only allow switching to a role the user already has)
  if (updates.activeRole) {
    const current = await User.findById(payload.userId).select("roles").lean();
    if (!current || Array.isArray(current))
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!(current as any).roles?.includes(updates.activeRole)) {
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

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(
    { user, message: "Profile updated" },
    { status: 200 }
  );
}
