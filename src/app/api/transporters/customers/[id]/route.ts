import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getTransporterCustomerDetail } from '@/lib/transporterPortal';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid customer id' }, { status: 400 });
  }

  const detail = await getTransporterCustomerDetail(user._id.toString(), id);
  if (!detail) {
    return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: detail }, { status: 200 });
}

