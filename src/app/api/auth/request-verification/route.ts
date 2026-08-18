import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import sendEmail from '@/lib/sendSmtpMail';

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
    return NextResponse.json({ ok: true, message: 'If this email exists, a verification code will be sent.' }, { status: 200 });
  }

  const code = generateCode();
  user.verificationCode = code;
  user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  let emailSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your verification code',
      template: 'register',
      replacements: {
        name: String(user.name ?? ''),
        email: user.email,
        verificationCode: code,
      }
    });
  } catch (error) {
    emailSent = false;
    console.error('Request verification email failed:', error);
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    message: emailSent
      ? 'Verification code sent'
      : 'Verification code refreshed, but the email could not be sent right now.'
  }, { status: 200 });
}
