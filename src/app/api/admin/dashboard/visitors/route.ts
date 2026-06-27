import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import { getAdminDashboardData } from '@/lib/adminDashboard';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const data = await getAdminDashboardData();
  return NextResponse.json(
    {
      success: true,
      data: {
        totalVisitors: data.userStats.activeAccountsCurrentPeriod,
        activeVisitors: data.userStats.activeAccounts7Days,
        deltaPercent: data.overview.visitors.deltaPercent,
        metricSource: 'user_activity_proxy'
      }
    },
    { status: 200 }
  );
}
