import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser } from '@/lib/apiAuth';
import { getTransporterReviewSummary } from '@/lib/transporterPortal';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const summary = await getTransporterReviewSummary(id);
  return NextResponse.json({ success: true, data: summary }, { status: 200 });
}

