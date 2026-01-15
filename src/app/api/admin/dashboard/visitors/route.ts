import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';

// No visitor tracking data is stored yet; return placeholder zeroes
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  return NextResponse.json(
    { success: true, data: { totalVisitors: 0, activeVisitors: 0 } },
    { status: 200 }
  );
}
