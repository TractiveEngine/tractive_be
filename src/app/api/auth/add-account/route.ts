import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export async function POST(request: Request) {
  await dbConnect();
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { role, businessName, villageOrLocalMarket, phone, nin, interests, ...rest } = await request.json();

  if (!role || !['buyer', 'agent', 'transporter', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Valid account type required' }, { status: 400 });
  }

  // Add role if not present
  if (!user.roles.includes(role)) {
    user.roles.push(role);
  }
  user.activeRole = role;

  // Update extra info
  if (businessName) user.businessName = businessName;
  if (villageOrLocalMarket) user.villageOrLocalMarket = villageOrLocalMarket;
  if (phone) user.phone = phone;
  if (nin) user.nin = nin;
  if (interests) user.interests = interests;
  Object.assign(user, rest);

  await user.save();

  return NextResponse.json({
    message: 'Account type and info updated.',
    user: { email: user.email, id: user._id, roles: user.roles, activeRole: user.activeRole },
  }, { status: 200 });
}
