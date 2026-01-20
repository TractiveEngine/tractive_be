import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { hash } from 'bcryptjs';
import sendEmail from '@/lib/sendSmtpMail';

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

function generateVerificationToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val : (val ? String(val) : '');
}

export async function POST(request: Request) {
  await dbConnect();
  const { email, password, name }: RegisterPayload = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const hashedPassword = await hash(password, 10);
  const verificationCode = generateVerificationToken();

  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    roles: [],
    activeRole: null,
    verificationCode,
    verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isVerified: false,
  });

  await sendEmail({
    to: user.email,
    subject: 'Verify your email for Tractive Engine',
    template: 'register',
    replacements: {
      name: safeString(user.name),
      email: safeString(user.email),
      verificationCode: verificationCode,
    }
  });

  return NextResponse.json({
    message: 'User registered. Verification email sent.',
    user: { email: user.email, id: user._id },
    emailVerificationSent: true,
  }, { status: 201 });
}
