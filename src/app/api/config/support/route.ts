import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      hotline: process.env.SUPPORT_HOTLINE || '+2348000000000',
      whatsapp: process.env.SUPPORT_WHATSAPP || '+2348000000000',
      email: process.env.SUPPORT_EMAIL || 'support@tractive.app'
    }
  }, { status: 200 });
}
