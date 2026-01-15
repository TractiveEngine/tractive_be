import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { hash } from 'bcryptjs';

export async function POST(request: Request) {
  await dbConnect();
  const { token, password, confirmPassword } = await request.json();

  // Validate required fields
  if (!token || !password || !confirmPassword) {
    return NextResponse.json({ 
      error: 'Token, password, and confirm password are required' 
    }, { status: 400 });
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return NextResponse.json({ 
      error: 'Passwords do not match' 
    }, { status: 400 });
  }

  // Validate password strength
  if (password.length < 8) {
    return NextResponse.json({ 
      error: 'Password must be at least 8 characters long' 
    }, { status: 400 });
  }

  // Find user with valid token
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordTokenExpiry: { $gt: new Date() }
  });

  if (!user) {
    return NextResponse.json({ 
      error: 'Invalid or expired reset token. Please request a new password reset.' 
    }, { status: 400 });
  }

  // Update password and clear reset token
  user.password = await hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpiry = undefined;
  await user.save();

  return NextResponse.json({ 
    message: 'Password reset successful. You can now login with your new password.',
    success: true 
  }, { status: 200 });
}
