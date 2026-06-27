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
    const agentApprovalStatus = searchParams.get('agentApprovalStatus'); // pending, approved, rejected
    const transporterApprovalStatus = searchParams.get('transporterApprovalStatus'); // pending, approved, rejected
    const search = searchParams.get('search'); // name or email search
    const state = searchParams.get('state');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
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

    if (agentApprovalStatus && ['pending', 'approved', 'rejected'].includes(agentApprovalStatus)) {
      query.agentApprovalStatus = agentApprovalStatus;
    }

    if (transporterApprovalStatus && ['pending', 'approved', 'rejected'].includes(transporterApprovalStatus)) {
      query.transporterApprovalStatus = transporterApprovalStatus;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    if (state) {
      query.state = { $regex: state, $options: 'i' };
    }

    if (year || month) {
      const createdAt: Record<string, Date> = {};
      const parsedYear = year ? Number(year) : undefined;
      const parsedMonth = month ? Number(month) : undefined;
      if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
        createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
        createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
      } else if (parsedYear) {
        createdAt.$gte = new Date(parsedYear, 0, 1);
        createdAt.$lt = new Date(parsedYear + 1, 0, 1);
      }
      if (Object.keys(createdAt).length > 0) {
        query.createdAt = createdAt;
      }
    }

    // Get users
    const users = await User.find(query)
      .select('_id name email roles activeRole status businessName phone createdAt isVerified agentApprovalStatus transporterApprovalStatus')
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
      transporterApprovalStatus: u.transporterApprovalStatus,
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
