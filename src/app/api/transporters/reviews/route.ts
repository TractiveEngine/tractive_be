import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/transporters/reviews
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const isAdmin = ensureActiveRole(user, 'admin');
  const isTransporter = ensureActiveRole(user, 'transporter');
  if (!isAdmin && !isTransporter) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const query = isAdmin ? {} : { agent: user._id };
  const reviews = await Review.find(query).populate('buyer', 'name email');

  return NextResponse.json({ success: true, data: reviews }, { status: 200 });
}
