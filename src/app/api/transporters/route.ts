import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/transporters - list transporters (buyer/admin)
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const transporters = await User.find({ roles: 'transporter', status: { $ne: 'removed' } })
    .select('_id name email phone businessName activeRole roles status')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: transporters }, { status: 200 });
}

// POST /api/transporters - create/update transporter profile (transporter/admin)
export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const isTransporter = ensureActiveRole(user, 'transporter');
  const isAdmin = ensureActiveRole(user, 'admin');
  if (!isTransporter && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const targetId = isAdmin && body?.userId ? body.userId : user._id.toString();

  const target = await User.findById(targetId);
  if (!target) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  if (!isAdmin && target._id.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  // Ensure transporter role
  if (!target.roles.includes('transporter')) {
    target.roles.push('transporter');
  }
  if (!target.activeRole) {
    target.activeRole = 'transporter';
  }

  const fields = ['name', 'phone', 'businessName', 'address', 'country', 'state'] as const;
  for (const key of fields) {
    if (body[key] !== undefined) {
      (target as any)[key] = body[key];
    }
  }

  await target.save();

  return NextResponse.json({ success: true, data: target, message: 'Transporter profile saved' }, { status: 201 });
}
