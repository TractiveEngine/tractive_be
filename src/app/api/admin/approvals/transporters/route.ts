import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

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
      roles: 'transporter',
      status: { $ne: 'removed' }
    };

    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query.transporterApprovalStatus =
        statusFilter === 'pending'
          ? { $in: ['pending', null] }
          : statusFilter;
    }

    const [transporters, total] = await Promise.all([
      User.find(query)
        .select('_id name email businessName phone status transporterApprovalStatus approvalNotes createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: transporters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching transporters for approval:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

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
    const { transporterId, transporterIds, status, reason } = await request.json();
    const ids = Array.isArray(transporterIds)
      ? transporterIds
      : transporterId
        ? [transporterId]
        : [];

    if (ids.length === 0 || !status) {
      return NextResponse.json({
        success: false,
        message: 'Transporter ID(s) and status are required'
      }, { status: 400 });
    }

    if (!ids.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
      return NextResponse.json({
        success: false,
        message: 'One or more transporter IDs are invalid'
      }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({
        success: false,
        message: 'Status must be either approved or rejected'
      }, { status: 400 });
    }

    const transporters = await User.find({
      _id: { $in: ids },
      roles: 'transporter'
    });
    if (transporters.length !== ids.length) {
      return NextResponse.json({
        success: false,
        message: 'One or more transporters were not found'
      }, { status: 404 });
    }

    for (const transporter of transporters) {
      transporter.transporterApprovalStatus = status;
      if (reason) {
        transporter.approvalNotes = reason;
      }
      await transporter.save();
    }

    return NextResponse.json({
      success: true,
      data: transporters.map((transporter) => ({
        _id: transporter._id,
        name: transporter.name || transporter.businessName,
        email: transporter.email,
        transporterApprovalStatus: transporter.transporterApprovalStatus,
        approvalNotes: transporter.approvalNotes
      })),
      message: ids.length === 1 ? `Transporter ${status} successfully` : `${ids.length} transporters ${status} successfully`
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating transporter approval:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
