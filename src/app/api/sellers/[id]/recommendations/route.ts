import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';

// GET /api/sellers/:id/recommendations
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const products = await Product.find({ owner: id, status: 'available' })
    .select('_id name images price')
    .sort({ createdAt: -1 })
    .limit(12);

  const data = products.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
    price: p.price
  }));

  return NextResponse.json({ success: true, data }, { status: 200 });
}

