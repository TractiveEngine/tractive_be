import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { requireAdmin } from '@/lib/apiAdmin';
import { getAdminUserHistory } from '@/lib/adminUserHistory';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid user id' }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const role = searchParams.get('role');
  const resource = searchParams.get('resource');

  if (!role || !resource) {
    return NextResponse.json(
      { success: false, message: 'role and resource query parameters are required' },
      { status: 400 }
    );
  }

  const result = await getAdminUserHistory({
    userId: id,
    role: role as any,
    resource: resource as any,
    searchParams
  });

  return NextResponse.json(result.body, { status: result.status });
}
