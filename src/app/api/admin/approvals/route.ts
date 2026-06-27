import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Farmer from '@/models/farmer';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const state = searchParams.get('state');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;

  const createdAt: Record<string, Date> = {};
  const parsedYear = year ? Number(year) : undefined;
  const parsedMonth = month ? Number(month) : undefined;
  if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
    createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
    createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
  } else if (parsedYear) {
    createdAt.$gte = new Date(parsedYear, 0, 1);
    createdAt.$lt = new Date(parsedYear + 1, 0, 1);
  }

  const queryText = search ? new RegExp(search, 'i') : null;
  const typeValue = type || 'agent';

  if (typeValue === 'agent' || typeValue === 'transporter') {
    const query: any = { roles: typeValue };
    if (typeValue === 'agent') {
      if (status && ['pending', 'approved', 'rejected', 'declined'].includes(status)) {
        query.agentApprovalStatus = status === 'declined' ? 'rejected' : status;
      }
    } else {
      if (status && ['pending', 'approved', 'rejected', 'declined'].includes(status)) {
        query.transporterApprovalStatus = status === 'declined' ? 'rejected' : status;
      }
    }
    if (queryText) {
      query.$or = [{ name: queryText }, { email: queryText }, { businessName: queryText }];
    }
    if (state) {
      query.state = { $regex: state, $options: 'i' };
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }

    const [records, total] = await Promise.all([
      User.find(query)
        .select('_id name email businessName phone image state address agentApprovalStatus transporterApprovalStatus createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: records.map((item: any) => ({
        _id: item._id.toString(),
        id: item._id.toString(),
        type: typeValue,
        name: item.name || item.businessName || 'Unknown',
        email: item.email || null,
        businessName: item.businessName || null,
        phone: item.phone || null,
        image: item.image || null,
        state: item.state || null,
        location: item.state || item.address || null,
        status: typeValue === 'agent' ? item.agentApprovalStatus : item.transporterApprovalStatus,
        createdAt: item.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });
  }

  const farmerQuery: any = {};
  if (status && ['pending', 'approved', 'rejected', 'declined'].includes(status)) {
    farmerQuery.approvalStatus = status === 'declined' ? 'rejected' : status;
  }
  if (queryText) {
    farmerQuery.$or = [{ name: queryText }, { businessName: queryText }, { phone: queryText }];
  }
  if (state) {
    farmerQuery.state = { $regex: state, $options: 'i' };
  }
  if (Object.keys(createdAt).length > 0) {
    farmerQuery.createdAt = createdAt;
  }

  const [records, total] = await Promise.all([
    Farmer.find(farmerQuery)
      .select('_id name businessName phone state approvalStatus createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Farmer.countDocuments(farmerQuery)
  ]);

  return NextResponse.json({
    success: true,
    data: records.map((item: any) => ({
      _id: item._id.toString(),
      id: item._id.toString(),
      type: 'farmer',
      name: item.name || item.businessName || 'Unknown',
      businessName: item.businessName || null,
      phone: item.phone || null,
      state: item.state || null,
      location: item.state || null,
      status: item.approvalStatus,
      createdAt: item.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, { status: 200 });
}
