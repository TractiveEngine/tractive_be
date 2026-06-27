import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Agent access required' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user._id,
      name: user.name || user.businessName || null,
      email: user.email,
      phone: user.phone || null,
      businessName: user.businessName || null,
      image: user.image || null,
      address: user.address || null,
      country: user.country || null,
      state: user.state || null,
      status: user.status,
      agentApprovalStatus: user.agentApprovalStatus ?? null,
      activeRole: user.activeRole,
      roles: user.roles || []
    }
  }, { status: 200 });
}

