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
    const statusFilter = searchParams.get('status') || 'pending';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const skip = (page - 1) * limit;
    const approvalQuery =
      statusFilter === 'pending'
        ? { $in: ['pending', null] }
        : statusFilter;

    const query = {
      roles: 'transporter',
      status: { $ne: 'removed' },
      transporterApprovalStatus: approvalQuery
    };

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
    const { transporterId, status, reason } = await request.json();

    if (!transporterId || !status) {
      return NextResponse.json({
        success: false,
        message: 'Transporter ID and status are required'
      }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(transporterId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid transporter ID format'
      }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({
        success: false,
        message: 'Status must be either approved or rejected'
      }, { status: 400 });
    }

    const transporter = await User.findById(transporterId);
    if (!transporter || !transporter.roles.includes('transporter')) {
      return NextResponse.json({
        success: false,
        message: 'Transporter not found'
      }, { status: 404 });
    }

    transporter.transporterApprovalStatus = status;
    if (reason) {
      transporter.approvalNotes = reason;
    }
    await transporter.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: transporter._id,
        name: transporter.name || transporter.businessName,
        email: transporter.email,
        transporterApprovalStatus: transporter.transporterApprovalStatus,
        approvalNotes: transporter.approvalNotes
      },
      message: `Transporter ${status} successfully`
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating transporter approval:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
