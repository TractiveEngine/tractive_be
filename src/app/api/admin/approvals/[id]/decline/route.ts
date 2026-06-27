import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Farmer from '@/models/farmer';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

async function updateApproval(id: string, reason?: string | null, typeHint?: string | null, adminUser?: any) {
  if (typeHint === 'agent' || !typeHint) {
    const agent = await User.findById(id);
    if (agent?.roles?.includes('agent')) {
      agent.agentApprovalStatus = 'rejected';
      if (reason) agent.approvalNotes = reason;
      await agent.save();
      return { type: 'agent', data: agent };
    }
  }
  if (typeHint === 'transporter' || !typeHint) {
    const transporter = await User.findById(id);
    if (transporter?.roles?.includes('transporter')) {
      transporter.transporterApprovalStatus = 'rejected';
      if (reason) transporter.approvalNotes = reason;
      await transporter.save();
      return { type: 'transporter', data: transporter };
    }
  }
  if (typeHint === 'farmer' || !typeHint) {
    const farmer = await Farmer.findById(id);
    if (farmer) {
      farmer.approvalStatus = 'rejected';
      if (reason) farmer.approvalNotes = reason;
      farmer.approvedBy = adminUser?._id || null;
      farmer.approvedAt = new Date();
      await farmer.save();
      return { type: 'farmer', data: farmer };
    }
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid approval id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const result = await updateApproval(id, body?.reason || body?.note || null, body?.type || null, user);
  if (!result) {
    return NextResponse.json({ success: false, message: 'Approval target not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      _id: result.data._id,
      id: result.data._id,
      type: result.type,
      status: 'rejected'
    },
    message: `${result.type} declined successfully`
  }, { status: 200 });
}
