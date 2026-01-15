import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

const STATUS = ['available', 'out_of_stock', 'discontinued'] as const;

export async function PATCH(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Only admin or agent can update product statuses' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const ids: string[] = body?.productIds || [];
  const status = body?.status;
  if (!STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }
  const validIds = ids.filter((i) => mongoose.Types.ObjectId.isValid(i));
  if (validIds.length === 0) {
    return NextResponse.json({ success: false, message: 'No valid productIds provided' }, { status: 400 });
  }

  const result = await Product.updateMany(
    { _id: { $in: validIds } },
    {
      $set: {
        status,
        ...(status === 'out_of_stock' ? { quantity: 0 } : {}),
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ success: true, data: { updatedCount: result.modifiedCount } }, { status: 200 });
}
