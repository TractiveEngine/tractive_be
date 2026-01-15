import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/product";
import User from "@/models/user";
import mongoose from "mongoose";
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
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Check if user has the required role in their roles array
  const hasRequiredRole = user.roles.some((r: string) => ["admin", "agent"].includes(r));
  if (!hasRequiredRole) {
    return NextResponse.json(
      { error: "You don't have permission to create products. Only admin or agent roles can create products." },
      { status: 403 }
    );
  }

  // Check if user is actively using the required role
  if (!user.activeRole || !["admin", "agent"].includes(user.activeRole)) {
    return NextResponse.json(
      { 
        error: "Please switch to agent or admin role to create products",
        currentRole: user.activeRole,
        availableRoles: user.roles,
        hint: "Update your active role to 'agent' or 'admin' to perform this action"
      },
      { status: 403 }
    );
  }

  const { name, description, price, quantity, unit, images, videos, categories, farmer } =
    await request.json();
  
  if (!name || !price) {
    return NextResponse.json(
      { error: "Name and price required" },
      { status: 400 }
    );
  }

  // Validate farmer if provided
  if (farmer) {
    const farmerExists = await mongoose.model('Farmer').findById(farmer);
    if (!farmerExists) {
      return NextResponse.json(
        { error: "Invalid farmer ID" },
        { status: 400 }
      );
    }
  }

  const product = await Product.create({
    name,
    description,
    price,
    quantity: quantity || 0,
    unit: unit || "kg",
    images: images || [],
    videos: videos || [],
    categories: categories || [],
    farmer: farmer || null,
    owner: user._id,
    status: "available",
  });

  return NextResponse.json({ 
    message: "Product created successfully",
    product 
  }, { status: 201 });
}

export async function GET() {
  await dbConnect();
  const products = await Product.find();
  return NextResponse.json({ products }, { status: 200 });
}
