import { NextResponse } from 'next/server';
import { getAuthUser, ensureActiveRole } from './apiAuth';

export async function requireAdmin(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return { error: NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 }) };
  }
  if (!ensureActiveRole(user, 'admin') && !(user.roles || []).includes('admin')) {
    return { error: NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}
