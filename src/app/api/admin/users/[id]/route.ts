import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/admin/users/:profession (alias) or /api/admin/users/:id
export async function GET(
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
  const professions = ['buyer', 'agent', 'transporter', 'admin'];

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    if (professions.includes(id)) {
      const query: any = { roles: id };
      if (status) {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .select('_id name email roles activeRole status businessName phone createdAt isVerified agentApprovalStatus transporterApprovalStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(query);

      const usersDto = users.map(u => ({
        _id: u._id,
        name: u.name || u.businessName || 'Unknown',
        email: u.email,
        profession: u.roles,
        activeRole: u.activeRole,
        status: u.status || 'active',
        phone: u.phone,
        isVerified: u.isVerified,
        agentApprovalStatus: u.agentApprovalStatus,
        transporterApprovalStatus: u.transporterApprovalStatus,
        createdAt: u.createdAt
      }));

      return NextResponse.json({
        success: true,
        data: {
          users: usersDto,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      }, { status: 200 });
    }

    if (mongoose.Types.ObjectId.isValid(id)) {
      const target = await User.findById(id)
        .select('_id name email roles activeRole status businessName phone createdAt isVerified agentApprovalStatus transporterApprovalStatus');

      if (!target) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          _id: target._id,
          name: target.name || target.businessName || 'Unknown',
          email: target.email,
          profession: target.roles,
          activeRole: target.activeRole,
          status: target.status || 'active',
          phone: target.phone,
          isVerified: target.isVerified,
          agentApprovalStatus: target.agentApprovalStatus,
          transporterApprovalStatus: target.transporterApprovalStatus,
          createdAt: target.createdAt
        }
      }, { status: 200 });
    }

    return NextResponse.json({ success: false, message: 'Invalid profession or user id' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching user by profession:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] - Update user status or profession
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();

  const adminUser = await getAuthUser(request);
  if (!adminUser) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(adminUser, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await Promise.resolve(params);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid user ID format' 
      }, { status: 400 });
    }

    const { status, profession } = await request.json();

    // Validate status if provided
    if (status && !['active', 'suspended', 'removed'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid status. Must be: active, suspended, or removed' 
      }, { status: 400 });
    }

    // Validate profession if provided
    if (profession && !['buyer', 'agent', 'transporter', 'admin'].includes(profession)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profession. Must be: buyer, agent, transporter, or admin' 
      }, { status: 400 });
    }

    // Find user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 });
    }

    // Update fields
    if (status) {
      targetUser.status = status;
    }

    if (profession) {
      // Add profession to roles if not already present
      if (!targetUser.roles.includes(profession)) {
        targetUser.roles.push(profession);
      }
      // Set as active role
      targetUser.activeRole = profession;
    }

    await targetUser.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: targetUser._id,
        name: targetUser.name || targetUser.businessName,
        email: targetUser.email,
        roles: targetUser.roles,
        activeRole: targetUser.activeRole,
        status: targetUser.status,
        updatedAt: targetUser.updatedAt
      },
      message: 'User updated successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
