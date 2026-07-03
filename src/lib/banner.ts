import Banner from '@/models/banner';

function isValidDate(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime());
}

export function normalizeBannerPayload(body: any, options?: { partial?: boolean }) {
  const partial = options?.partial === true;
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const link = typeof body?.link === 'string' ? body.link.trim() : '';
  const alt = typeof body?.alt === 'string' ? body.alt.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const position = body?.position !== undefined ? Number(body.position) : undefined;
  const isActive = body?.isActive;
  const startDate = body?.startDate;
  const endDate = body?.endDate;

  if (!partial || body?.imageUrl !== undefined) {
    if (!imageUrl) {
      throw new Error('imageUrl is required');
    }
    try {
      new URL(imageUrl);
    } catch {
      throw new Error('imageUrl must be a valid absolute URL');
    }
  }

  if (body?.link !== undefined && link) {
    const isRelative = link.startsWith('/');
    if (!isRelative) {
      try {
        new URL(link);
      } catch {
        throw new Error('link must be an absolute URL or app-relative path');
      }
    }
  }

  if (body?.position !== undefined && (!Number.isFinite(position) || position < 0)) {
    throw new Error('position must be a non-negative number');
  }

  if (body?.isActive !== undefined && typeof isActive !== 'boolean') {
    throw new Error('isActive must be a boolean');
  }

  if (startDate !== undefined && startDate !== null && startDate !== '' && !isValidDate(startDate)) {
    throw new Error('startDate must be a valid ISO date');
  }
  if (endDate !== undefined && endDate !== null && endDate !== '' && !isValidDate(endDate)) {
    throw new Error('endDate must be a valid ISO date');
  }

  const normalized: Record<string, unknown> = {};
  if (!partial || body?.title !== undefined) normalized.title = title || null;
  if (!partial || body?.imageUrl !== undefined) normalized.imageUrl = imageUrl;
  if (!partial || body?.link !== undefined) normalized.link = link || null;
  if (!partial || body?.alt !== undefined) normalized.alt = alt;
  if (!partial || body?.position !== undefined) normalized.position = position ?? 0;
  if (!partial || body?.isActive !== undefined) normalized.isActive = body?.isActive ?? true;
  if (!partial || body?.startDate !== undefined) normalized.startDate = startDate ? new Date(startDate) : null;
  if (!partial || body?.endDate !== undefined) normalized.endDate = endDate ? new Date(endDate) : null;

  const normalizedStartDate = normalized.startDate as Date | null | undefined;
  const normalizedEndDate = normalized.endDate as Date | null | undefined;
  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    throw new Error('startDate cannot be later than endDate');
  }

  return normalized;
}

export function serializeBanner(banner: any) {
  return {
    _id: banner._id?.toString?.() || banner._id,
    title: banner.title || null,
    imageUrl: banner.imageUrl || null,
    link: banner.link || null,
    alt: banner.alt || '',
    position: typeof banner.position === 'number' ? banner.position : 0,
    isActive: banner.isActive !== false,
    startDate: banner.startDate || null,
    endDate: banner.endDate || null,
    createdBy: banner.createdBy?._id?.toString?.() || banner.createdBy || null,
    createdAt: banner.createdAt || null,
    updatedAt: banner.updatedAt || null
  };
}

export async function getActiveBanners() {
  const now = new Date();
  const banners = await Banner.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
    ]
  })
    .sort({ position: 1, createdAt: -1 })
    .lean();

  return banners.map(serializeBanner);
}
