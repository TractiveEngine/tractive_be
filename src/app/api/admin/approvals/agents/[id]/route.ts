import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// PATCH /api/admin/approvals/agents/:id - Approve or reject agent
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid agent id' }, { status: 400 });
  }

  const { status, reason } = await request.json().catch(() => ({}));
  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Status must be either approved or rejected' }, { status: 400 });
  }

  const agent = await User.findById(id);
  if (!agent || !agent.roles.includes('agent')) {
    return NextResponse.json({ success: false, message: 'Agent not found' }, { status: 404 });
  }

  agent.agentApprovalStatus = status;
  if (reason) {
    agent.approvalNotes = reason;
  }
  await agent.save();

  return NextResponse.json({
    success: true,
    data: {
      _id: agent._id,
      name: agent.name || agent.businessName,
      email: agent.email,
      agentApprovalStatus: agent.agentApprovalStatus,
      approvalNotes: agent.approvalNotes
    },
    message: `Agent ${status} successfully`
  }, { status: 200 });
}
