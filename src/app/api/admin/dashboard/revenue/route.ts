import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import { getAdminDashboardData } from '@/lib/adminDashboard';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const data = await getAdminDashboardData({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    period: searchParams.get('period')
  });
  return NextResponse.json({
    success: true,
    data: data.revenueStats.revenueChart.map((item: any) => ({
      date: item.label,
      value: item.amount
    }))
  }, { status: 200 });
}
