import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/product";
import User from "@/models/user";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

// 1) Define the shape your JWT actually has
type JwtUserPayload = {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
};

// 2) Tiny type guard
function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return (
    typeof p === "object" &&
    p !== null &&
    "userId" in p &&
    typeof (p as JwtUserPayload).userId === "string"
  );
}

// 3) Verify + return a typed payload (or null)
function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !isJwtUserPayload(decoded)) return null;
    return decoded; // typed as JwtUserPayload
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const user = await User.findById(userData.userId);
  if (
    !user ||
    !user.roles.some((r: string) => ["admin", "agent"].includes(r))
  ) {
    return NextResponse.json(
      { error: "Only admin or agent can create products" },
      { status: 403 }
    );
  }

  const { name, description, price, quantity, images, videos } =
    await request.json();
  if (!name || !price) {
    return NextResponse.json(
      { error: "Name and price required" },
      { status: 400 }
    );
  }

  const product = await Product.create({
    name,
    description,
    price,
    quantity,
    images: images || [],
    videos: videos || [],
    owner: user._id,
  });

  return NextResponse.json({ product }, { status: 201 });
}

export async function GET() {
  await dbConnect();
  const products = await Product.find();
  return NextResponse.json({ products }, { status: 200 });
}
