import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// GET /api/transporters/:id
export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const transporter = await User.findById(id).select('_id name email phone businessName roles activeRole status');
  if (!transporter || !transporter.roles.includes('transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: transporter }, { status: 200 });
}
