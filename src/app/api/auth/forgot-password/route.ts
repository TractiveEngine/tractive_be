import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import sendEmail from '@/lib/sendSmtpMail';
import crypto from 'crypto';

function generateResetToken() {
  // Generate secure random token
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  await dbConnect();
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user) {
    // For security, respond with success even if user not found
    return NextResponse.json({ message: 'If your email exists, you will receive a reset link.' }, { status: 200 });
  }

  const resetToken = generateResetToken();
  user.resetPasswordToken = resetToken;
  user.resetPasswordTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  // Frontend reset password page URL with token
  const resetLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    template: 'reset-password',
    replacements: {
      name: user.name || user.email,
      resetLink: resetLink,
    }
  });

  return NextResponse.json({ message: 'If your email exists, you will receive a reset link.' }, { status: 200 });
}
