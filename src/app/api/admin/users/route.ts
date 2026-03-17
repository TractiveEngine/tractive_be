import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/admin/users - List users with filters
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
    
    // Query parameters
    const profession = searchParams.get('profession'); // buyer, agent, transporter, admin
    const status = searchParams.get('status'); // active, suspended, removed
    const search = searchParams.get('search'); // name or email search
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    
    if (profession) {
      query.roles = profession;
    }
    
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

    // Get users
    const users = await User.find(query)
      .select('_id name email roles activeRole status businessName phone createdAt isVerified agentApprovalStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Format response
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
      createdAt: u.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: usersDto,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
