import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Banner from '@/models/banner';
import { requireAdmin } from '@/lib/apiAdmin';
import { normalizeBannerPayload, serializeBanner } from '@/lib/banner';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const active = searchParams.get('active');
  const search = searchParams.get('search');

  const query: Record<string, unknown> = {};
  if (active === 'true') query.isActive = true;
  if (active === 'false') query.isActive = false;
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ title: regex }, { alt: regex }, { link: regex }];
  }

  const [banners, total] = await Promise.all([
    Banner.find(query).sort({ position: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Banner.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: banners.map(serializeBanner),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }, { status: 200 });
}

export async function POST(request: Request) {
  const { error, user } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const body: any = await request.json().catch(() => ({}));
  let payload;
  try {
    payload = normalizeBannerPayload(body);
  } catch (validationError: any) {
    return NextResponse.json({ success: false, message: validationError?.message || 'Invalid banner payload' }, { status: 400 });
  }

  const banner = await Banner.create({
    ...payload,
    createdBy: user?._id || null
  });

  return NextResponse.json({
    success: true,
    data: serializeBanner(banner.toObject())
  }, { status: 201 });
}
