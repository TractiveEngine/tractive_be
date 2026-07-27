import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
import { getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const count = await Notification.countDocuments({ user: user._id, isRead: false });
  return NextResponse.json({ success: true, count, unreadCount: count, data: { count } }, { status: 200 });
}
