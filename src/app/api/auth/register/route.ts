import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { hash } from 'bcryptjs';
import sendEmail from '@/lib/sendSmtpMail';
import crypto from 'crypto';

function generateVerificationToken() {
  // Generate a random 6-digit code as string
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function safeString(val: any): string {
  return typeof val === 'string' ? val : (val ? String(val) : '');
}

const getRoleSpecificContent = (role: string, user: any) => {
  const code = safeString(user.verificationCode);
  switch (role) {
    case 'buyer':
      return {
        template: 'buyer-signup',
        subject: 'Welcome to Agric - Buyer Account',
        data: {
          name: safeString(user.name),
          email: safeString(user.email),
          verificationCode: code,
        }
      };
    case 'agent':
      return {
        template: 'agent-signup',
        subject: 'Welcome to Agric - Agent Account',
        data: {
          name: safeString(user.name),
          email: safeString(user.email),
          verificationCode: code,
        }
      };
    case 'admin':
      return {
        template: 'admin-signup',
        subject: 'Welcome to Agric - Admin Account',
        data: {
          name: safeString(user.name),
          email: safeString(user.email),
          verificationCode: code,
        }
      };
    default:
      return {
        template: 'signup',
        subject: 'Welcome to Tractive Engine',
        data: {
          name: safeString(user.name),
          email: safeString(user.email),
          verificationCode: code,
        }
      };
  }
};

export async function POST(request: Request) {
  await dbConnect();
  const { email, password, role, ...rest } = await request.json();

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, password, and role required' }, { status: 400 });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const hashedPassword = await hash(password, 10);

  // Generate verification code
  const verificationCode = generateVerificationToken();

  // Save user with verification code
  const user = await User.create({
    email,
    password: hashedPassword,
    role,
    ...rest,
    verificationCode,
    verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    isVerified: false,
  });

  // Prepare and send verification email
  const emailConfig = getRoleSpecificContent(role, user);

  await sendEmail({
    to: user.email,
    subject: emailConfig.subject,
    template: emailConfig.template,
    replacements: emailConfig.data as Record<string, string>
  });

  return NextResponse.json({
    message: 'User registered. Verification email sent.',
    user: { email: user.email, id: user._id },
    emailVerificationSent: true,
  }, { status: 201 });
}