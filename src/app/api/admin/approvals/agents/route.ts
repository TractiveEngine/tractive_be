import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/admin/approvals/agents - List agents pending approval
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';

    // Find agents with approval status
    const agents = await User.find({
      roles: 'agent',
      agentApprovalStatus: statusFilter
    })
      .select('_id name email businessName phone nin businessCAC agentApprovalStatus approvalNotes createdAt')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: agents
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching agents for approval:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// PATCH /api/admin/approvals/agents - Approve or reject agent
export async function PATCH(request: Request) {
  await dbConnect();

  const adminUser = await getAuthUser(request);
  if (!adminUser) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(adminUser, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { agentId, status, reason } = await request.json();

    // Validate required fields
    if (!agentId || !status) {
      return NextResponse.json({ 
        success: false, 
        message: 'Agent ID and status are required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid agent ID format' 
      }, { status: 400 });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Status must be either approved or rejected' 
      }, { status: 400 });
    }

    // Find agent
    const agent = await User.findById(agentId);
    if (!agent || !agent.roles.includes('agent')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Agent not found' 
      }, { status: 404 });
    }

    // Update approval status
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

  } catch (error) {
    console.error('Error updating agent approval:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
