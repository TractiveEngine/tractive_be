import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/admin/approvals/farmers - List farmers pending approval
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';

    // Find farmers with approval status
    const farmers = await Farmer.find({
      approvalStatus: statusFilter
    })
      .populate('createdBy', 'name email businessName')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: farmers
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching farmers for approval:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// PATCH /api/admin/approvals/farmers - Approve or reject farmer
export async function PATCH(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const adminUser = await User.findById(userData.userId);
  if (!adminUser || !adminUser.roles.includes('admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { farmerId, status, reason } = await request.json();

    // Validate required fields
    if (!farmerId || !status) {
      return NextResponse.json({ 
        success: false, 
        message: 'Farmer ID and status are required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid farmer ID format' 
      }, { status: 400 });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Status must be either approved or rejected' 
      }, { status: 400 });
    }

    // Find farmer
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) {
      return NextResponse.json({ 
        success: false, 
        message: 'Farmer not found' 
      }, { status: 404 });
    }

    // Update approval status
    farmer.approvalStatus = status;
    if (reason) {
      farmer.approvalNotes = reason;
    }
    farmer.approvedBy = adminUser._id;
    farmer.approvedAt = new Date();
    await farmer.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: farmer._id,
        name: farmer.name,
        approvalStatus: farmer.approvalStatus,
        approvalNotes: farmer.approvalNotes,
        approvedBy: adminUser.name || adminUser.email,
        approvedAt: farmer.approvedAt
      },
      message: `Farmer ${status} successfully`
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating farmer approval:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
