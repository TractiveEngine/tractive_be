import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

const UPDATABLE_FIELDS = [
  'name',
  'phone',
  'businessName',
  'nin',
  'businessCAC',
  'address',
  'country',
  'state',
  'lga',
  'villageOrLocalMarket'
] as const;

// GET /api/farmers/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Agent or admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer id' }, { status: 400 });
  }

  const farmer = await Farmer.findById(id);
  if (!farmer) {
    return NextResponse.json({ success: false, message: 'Farmer not found' }, { status: 404 });
  }

  if (!ensureActiveRole(user, 'admin') && farmer.createdBy.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: farmer }, { status: 200 });
}

async function updateFarmer(
  request: Request,
  params: Promise<{ id: string }>,
  options: { replaceAll: boolean }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Agent or admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer id' }, { status: 400 });
  }

  const farmer = await Farmer.findById(id);
  if (!farmer) {
    return NextResponse.json({ success: false, message: 'Farmer not found' }, { status: 404 });
  }

  if (!ensureActiveRole(user, 'admin') && farmer.createdBy.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (options.replaceAll && (body.name === undefined || body.name === null || body.name === '')) {
    return NextResponse.json({ success: false, message: 'Farmer name required' }, { status: 400 });
  }

  for (const field of UPDATABLE_FIELDS) {
    if (options.replaceAll) {
      (farmer as any)[field] = body[field] ?? null;
    } else if (body[field] !== undefined) {
      (farmer as any)[field] = body[field];
    }
  }

  await farmer.save();

  return NextResponse.json({ success: true, data: farmer, message: 'Farmer updated' }, { status: 200 });
}

// PUT /api/farmers/:id
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return updateFarmer(request, params, { replaceAll: true });
}

// PATCH /api/farmers/:id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return updateFarmer(request, params, { replaceAll: false });
}

// DELETE /api/farmers/:id
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Agent or admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer id' }, { status: 400 });
  }

  const farmer = await Farmer.findById(id);
  if (!farmer) {
    return NextResponse.json({ success: false, message: 'Farmer not found' }, { status: 404 });
  }

  if (!ensureActiveRole(user, 'admin') && farmer.createdBy.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  await farmer.deleteOne();
  return NextResponse.json({ success: true, message: 'Farmer deleted' }, { status: 200 });
}
