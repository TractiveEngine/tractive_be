import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import User from '@/models/user';
import mongoose from 'mongoose';

// GET /api/sellers/:id/products - products owned by seller
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const seller = await User.findById(id).select('_id roles activeRole');
  if (!seller) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  // Critical scope: seller catalog is products owned by this seller only.
  const query: Record<string, unknown> = { owner: id };
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ name: regex }, { description: regex }];
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .select('_id name description price quantity unit images status createdAt discount categories')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: products,
    pagination: { total, page, limit }
  }, { status: 200 });
}
