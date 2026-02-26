import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';

// GET /api/products/:id/similar
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const product = await Product.findById(id).select('_id categories owner');
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 12));

  const categories = Array.isArray(product.categories) ? product.categories : [];
  const query: Record<string, unknown> = {
    _id: { $ne: product._id },
    status: 'available'
  };

  if (categories.length > 0) {
    query.categories = { $in: categories };
  } else if (product.owner) {
    // fallback if category is absent
    query.owner = { $ne: product.owner };
  }

  const similar = await Product.find(query)
    .select('_id name description price quantity unit images status discount categories createdAt owner farmer')
    .sort({ createdAt: -1 })
    .limit(limit);

  return NextResponse.json({ success: true, data: similar }, { status: 200 });
}

