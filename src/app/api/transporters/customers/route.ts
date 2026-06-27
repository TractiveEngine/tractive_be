import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getTransporterCustomerSummaries } from '@/lib/transporterPortal';

// GET /api/transporters/customers - Get list of customers served by transporter
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ error: 'Only transporters can view customers' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const search = searchParams.get('search');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const allCustomers = await getTransporterCustomerSummaries(user._id.toString(), {
      search,
      year,
      month
    });
    const total = allCustomers.length;
    const start = (page - 1) * limit;
    const customers = allCustomers.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
