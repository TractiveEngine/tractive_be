import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import '@/models/banner';
import { getActiveBanners } from '@/lib/banner';

export async function GET(request: Request) {
  await dbConnect();
  return NextResponse.json({
    success: true,
    data: await getActiveBanners()
  }, { status: 200 });
}
