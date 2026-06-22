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
    const statusFilter = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {
      roles: 'agent',
      status: { $ne: 'removed' }
    };

    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query.agentApprovalStatus =
        statusFilter === 'pending'
          ? { $in: ['pending', null] }
          : statusFilter;
    }

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
    const { agentId, agentIds, status, reason } = await request.json();
    const ids = Array.isArray(agentIds)
      ? agentIds
      : agentId
        ? [agentId]
        : [];

    // Validate required fields
    if (ids.length === 0 || !status) {
      return NextResponse.json({ 
        success: false, 
        message: 'Agent ID(s) and status are required' 
      }, { status: 400 });
    }

    if (!ids.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
      return NextResponse.json({ 
        success: false, 
        message: 'One or more agent IDs are invalid' 
      }, { status: 400 });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Status must be either approved or rejected' 
      }, { status: 400 });
    }

    const agents = await User.find({
      _id: { $in: ids },
      roles: 'agent'
    });
    if (agents.length !== ids.length) {
      return NextResponse.json({ 
        success: false, 
        message: 'One or more agents were not found' 
      }, { status: 404 });
    }

    for (const agent of agents) {
      agent.agentApprovalStatus = status;
      if (reason) {
        agent.approvalNotes = reason;
      }
      await agent.save();
    }

    return NextResponse.json({
      success: true,
      data: agents.map((agent) => ({
        _id: agent._id,
        name: agent.name || agent.businessName,
        email: agent.email,
        agentApprovalStatus: agent.agentApprovalStatus,
        approvalNotes: agent.approvalNotes
      })),
      message: ids.length === 1 ? `Agent ${status} successfully` : `${ids.length} agents ${status} successfully`
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating agent approval:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
