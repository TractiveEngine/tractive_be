import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';

export async function POST(request: Request) {
  await dbConnect();
  const { email, code } = await request.json();
  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Trim both codes before comparison
  if ((user.verificationCode ?? '').trim() !== code.trim()) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  await user.save();

  return NextResponse.json({ message: 'Email verified' }, { status: 200 });
}

