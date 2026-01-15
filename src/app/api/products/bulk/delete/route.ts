import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Only admin or agent can delete products' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const ids: string[] = body?.productIds || [];
  const validIds = ids.filter((i) => mongoose.Types.ObjectId.isValid(i));
  if (validIds.length === 0) {
    return NextResponse.json({ success: false, message: 'No valid productIds provided' }, { status: 400 });
  }

  const result = await Product.deleteMany({ _id: { $in: validIds } });
  return NextResponse.json({ success: true, data: { deletedCount: result.deletedCount } }, { status: 200 });
}
