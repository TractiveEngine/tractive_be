import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/product";
import mongoose from "mongoose";
import { attachWishlistedFlag, buildCategoryFields } from "@/lib/productPayload";
import { getAuthUser } from "@/lib/apiAuth";
import { normalizeLocalTransport } from "@/lib/localTransport";

export async function POST(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
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

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid or empty JSON body. Please send a valid JSON payload." },
      { status: 400 }
    );
  }

  const { name, description, price, quantity, unit, images, videos, categories, category, subcategory, farmer, discount } = body;
  
  if (!name || !price) {
    return NextResponse.json(
      { error: "Name and price required" },
      { status: 400 }
    );
  }

  // Validate and coerce price to number
  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return NextResponse.json(
      { error: "Price must be a valid positive number" },
      { status: 400 }
    );
  }

  // Validate and coerce quantity
  const numQuantity = quantity ? Number(quantity) : 0;
  if (isNaN(numQuantity) || numQuantity < 0) {
    return NextResponse.json(
      { error: "Quantity must be a valid non-negative number" },
      { status: 400 }
    );
  }

  // Validate and coerce discount if provided (percentage 0-100)
  const numDiscount = discount !== undefined ? Number(discount) : 0;
  if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) {
    return NextResponse.json(
      { error: "Discount must be a number between 0 and 100" },
      { status: 400 }
    );
  }

  const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
  const hasDataUri = (items: string[]) => items.some((item) => item.trim().toLowerCase().startsWith("data:"));

  if (images !== undefined) {
    if (!isStringArray(images)) {
      return NextResponse.json(
        { error: "Images must be an array of URL strings" },
        { status: 400 }
      );
    }
    if (hasDataUri(images)) {
      return NextResponse.json(
        { error: "Images must be URL links, not base64 data" },
        { status: 400 }
      );
    }
  }

  if (videos !== undefined) {
    if (!isStringArray(videos)) {
      return NextResponse.json(
        { error: "Videos must be an array of URL strings" },
        { status: 400 }
      );
    }
    if (hasDataUri(videos)) {
      return NextResponse.json(
        { error: "Videos must be URL links, not base64 data" },
        { status: 400 }
      );
    }
  }

  // Validate farmer id format if provided
  if (farmer && !mongoose.Types.ObjectId.isValid(farmer)) {
    return NextResponse.json(
      { error: "Invalid farmer ID format" },
      { status: 400 }
    );
  }

  const categoryFields = buildCategoryFields({ category, subcategory, categories });
  let localTransport;
  try {
    localTransport = normalizeLocalTransport(body);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Invalid local transport data" },
      { status: 400 }
    );
  }

  try {
    const product = await Product.create({
      name,
      description,
      price: numPrice,
      quantity: numQuantity,
      unit: unit || "kg",
      images: images || [],
      videos: videos || [],
      ...categoryFields,
      farmer: farmer || null,
      owner: user._id,
      status: "available",
      discount: numDiscount,
      localTransport,
    });

    return NextResponse.json({ 
      message: "Product created successfully",
      product 
    }, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}

export async function GET(request?: Request) {
  await dbConnect();
  const effectiveRequest = request ?? new Request('http://localhost:3000/api/products');
  const authUser = await getAuthUser(effectiveRequest);
  const { searchParams } = new URL(effectiveRequest.url);
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const farmer = searchParams.get("farmer");
  const owner = searchParams.get("owner");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase();
  const fullParam = searchParams.get("full");
  const full = fullParam === "true" || fullParam === "1";
  const includeMediaParam = searchParams.get("includeMedia");
  const includeMedia = includeMediaParam === "false" || includeMediaParam === "0" ? false : true;

  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [{ name: regex }, { description: regex }];
  }
  if (status) {
    query.status = status;
  }
  if (category && subcategory) {
    query.categories = { $all: [category, subcategory] };
  } else if (category) {
    query.categories = category;
  } else if (subcategory) {
    query.categories = subcategory;
  }
  if (farmer) {
    query.farmer = farmer;
  }
  if (owner) {
    query.owner = owner;
  } else if (authUser?.activeRole === 'agent') {
    // Agent product management view should be scoped to products they own.
    query.owner = authUser._id;
  }
  if (minPrice || maxPrice) {
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    const priceQuery: Record<string, number> = {};
    if (min !== undefined && !Number.isNaN(min)) priceQuery.$gte = min;
    if (max !== undefined && !Number.isNaN(max)) priceQuery.$lte = max;
    if (Object.keys(priceQuery).length > 0) {
      query.price = priceQuery;
    }
  }
  if (fromDate || toDate) {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    const dateQuery: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) dateQuery.$gte = from;
    if (to && !Number.isNaN(to.getTime())) dateQuery.$lte = to;
    if (Object.keys(dateQuery).length > 0) {
      query.createdAt = dateQuery;
    }
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection };

  const projection = full
    ? undefined
    : includeMedia
      ? "name description price quantity unit discount status categories images videos farmer owner localTransport createdAt updatedAt"
      : "name description price quantity unit discount status categories farmer owner localTransport createdAt updatedAt";

  const [products, total] = await Promise.all([
    Product.find(query).select(projection).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(query)
  ]);

  const normalized = await attachWishlistedFlag(
    products,
    authUser ? { userId: authUser._id.toString() } : null
  );

  return NextResponse.json({
    data: normalized,
    products: normalized, // legacy compatibility
    pagination: { page, limit, total }
  }, { status: 200 });
}
