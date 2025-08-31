import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { hash } from 'bcryptjs';

export async function POST(request: Request) {
  await dbConnect();
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordTokenExpiry: { $gt: new Date() }
  });

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  user.password = await hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpiry = undefined;
  await user.save();

  return NextResponse.json({ message: 'Password reset successful' }, { status: 200 });
}
