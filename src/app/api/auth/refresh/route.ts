import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { signRefreshToken, signToken, verifyRefreshToken } from '@/lib/auth';

export async function POST(request: Request) {
  await dbConnect();
  const body = await request.json().catch(() => ({}));
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('refreshToken='))
    ?.split('=')[1];
  const refreshToken = body.refreshToken || cookieToken;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.refreshToken) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }

  if (user.refreshToken !== refreshToken) {
    return NextResponse.json({ error: 'Refresh token mismatch' }, { status: 401 });
  }

  if (user.refreshTokenExpiry && user.refreshTokenExpiry < new Date()) {
    return NextResponse.json({ error: 'Refresh token expired' }, { status: 401 });
  }

  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return NextResponse.json({ error: 'Refresh token revoked' }, { status: 401 });
  }

  const tokenVersion = user.tokenVersion ?? 0;
  const token = signToken({ userId: user._id, email: user.email, tokenVersion });
  const newRefreshToken = signRefreshToken({ userId: user._id, email: user.email, tokenVersion });
  user.refreshToken = newRefreshToken;
  user.refreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();

  const response = NextResponse.json({ token, refreshToken: newRefreshToken }, { status: 200 });
  response.cookies.set('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60
  });
  return response;
}
