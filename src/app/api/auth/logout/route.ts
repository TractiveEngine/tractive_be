import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  await dbConnect();
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  user.refreshToken = undefined;
  user.refreshTokenExpiry = undefined;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  return NextResponse.json({ success: true, message: 'Logged out' }, { status: 200 });
}
