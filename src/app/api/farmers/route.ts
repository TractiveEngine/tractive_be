import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ error: 'Only agents or admins can create farmers' }, { status: 403 });
  }

  const {
    name, phone, businessName, nin, businessCAC, address,
    country, state, lga, villageOrLocalMarket
  } = await request.json();

  if (!name) {
    return NextResponse.json({ error: 'Farmer name required' }, { status: 400 });
  }

  const farmer = await Farmer.create({
    name,
    phone,
    businessName,
    nin,
    businessCAC,
    address,
    country,
    state,
    lga,
    villageOrLocalMarket,
    createdBy: user._id,
  });

  return NextResponse.json({ farmer }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  // Only return farmers created by the authenticated user
  const farmers = await Farmer.find({ createdBy: user._id });
  return NextResponse.json({ farmers }, { status: 200 });
}
