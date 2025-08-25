import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  await dbConnect();
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const code = generateCode();
  user.verificationCode = code;
  await user.save();

  // TODO: Send code via email (mocked here)
  console.log(`Verification code for ${email}: ${code}`);

  return NextResponse.json({ message: 'Verification code sent' }, { status: 200 });
}
