import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Banner from '@/models/banner';
import { requireAdmin } from '@/lib/apiAdmin';
import { normalizeBannerPayload, serializeBanner } from '@/lib/banner';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid banner id' }, { status: 400 });
  }

  const banner = await Banner.findById(id).lean();
  if (!banner) {
    return NextResponse.json({ success: false, message: 'Banner not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: serializeBanner(banner) }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid banner id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  let payload;
  try {
    payload = normalizeBannerPayload(body, { partial: true });
  } catch (validationError: any) {
    return NextResponse.json({ success: false, message: validationError?.message || 'Invalid banner payload' }, { status: 400 });
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, message: 'No valid fields provided' }, { status: 400 });
  }

  const banner = await Banner.findByIdAndUpdate(
    id,
    { $set: { ...payload, updatedAt: new Date() } },
    { new: true }
  ).lean();

  if (!banner) {
    return NextResponse.json({ success: false, message: 'Banner not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: serializeBanner(banner) }, { status: 200 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid banner id' }, { status: 400 });
  }

  const banner = await Banner.findByIdAndDelete(id).lean();
  if (!banner) {
    return NextResponse.json({ success: false, message: 'Banner not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Banner deleted' }, { status: 200 });
}
