import { NextResponse } from 'next/server';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getAgentDashboardData } from '@/lib/agentPortal';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Agent access required' }, { status: 403 });
  }

  const data = await getAgentDashboardData(user._id.toString());
  return NextResponse.json({ success: true, data: data.overview }, { status: 200 });
}

