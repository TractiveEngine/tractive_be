import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import sendEmail from '@/lib/sendSmtpMail';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

interface AddAccountPayload {
  role: 'buyer' | 'agent' | 'transporter' | 'admin';
  businessName?: string;
  villageOrLocalMarket?: string;
  phone?: string;
  nin?: string;
  interests?: string[];
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  let decoded: { userId: string } | null;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const payload: AddAccountPayload = await request.json();
  const { role, businessName, villageOrLocalMarket, phone, nin, interests, ...rest } = payload;

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
  const sanitized = { ...rest } as Record<string, unknown>;
  delete sanitized.roles;
  delete sanitized.activeRole;
  Object.assign(user, sanitized);

  await user.save();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || 'https://tractive-be.vercel.app';
  try {
    await sendEmail({
      to: user.email,
      subject: `Your ${role} account is ready`,
      template: 'role-added',
      replacements: {
        name: user.name || user.businessName || 'there',
        role,
        email: user.email,
        appUrl
      }
    });
  } catch (error) {
    console.error('Error sending role-added email:', error);
  }

  return NextResponse.json({
    message: 'Account type and info updated.',
    user: { email: user.email, id: user._id, roles: user.roles, activeRole: user.activeRole },
  }, { status: 200 });
}
