import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import { getAdminDashboardData } from '@/lib/adminDashboard';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 7));
  const data = await getAdminDashboardData({ topBuyersLimit: limit });
  return NextResponse.json({
    success: true,
    data: data.topBuyers.map((item: any) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      totalSpent: item.totalSpent
    }))
  }, { status: 200 });
}
