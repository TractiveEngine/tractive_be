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
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const skip = (page - 1) * limit;
    const approvalQuery =
      statusFilter === 'pending'
        ? { $in: ['pending', null] }
        : statusFilter;
    const query = {
      roles: 'agent',
      status: { $ne: 'removed' },
      agentApprovalStatus: approvalQuery
    };

    const [agents, total] = await Promise.all([
      User.find(query)
        .select('_id name email businessName phone nin businessCAC status agentApprovalStatus approvalNotes createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
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
