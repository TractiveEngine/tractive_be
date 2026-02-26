import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import User from '@/models/user';
import Review from '@/models/review';

// GET /api/sellers - list sellers (agents with products)
export async function GET(request: Request) {
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.get('search');
  const state = searchParams.get('state');
  const year = searchParams.get('year');
  const minRating = searchParams.get('rating');

  const ownerAgg = await Product.aggregate([
    { $group: { _id: '$owner', productsCount: { $sum: 1 } } },
    { $sort: { productsCount: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  const total = await Product.distinct('owner').then((owners) => owners.length);

  const sellersRaw = await Promise.all(
    ownerAgg.map(async (o) => {
      const seller = await User.findById(o._id);
      const ratingAgg = await Review.aggregate([
        { $match: { agent: o._id } },
        { $group: { _id: '$agent', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      const rating = ratingAgg[0]?.avg ?? 0;
      const totalReviews = ratingAgg[0]?.count ?? 0;
      const rateStatus =
        rating >= 4.5 ? 'Excellent' :
        rating >= 3.5 ? 'Good' :
        rating > 0 ? 'Average' : 'Not rated';
      const sellerYear = seller?.createdAt
        ? Math.max(0, new Date().getFullYear() - new Date(seller.createdAt).getFullYear())
        : 0;
      return {
        sellerId: o._id?.toString(),
        name: seller?.name || seller?.businessName || 'Unknown',
        email: seller?.email,
        image: seller?.image || null,
        rating,
        totalReviews,
        rateStatus,
        sellerYear,
        location: [seller?.state, seller?.country].filter(Boolean).join(', ') || null,
        productsCount: o.productsCount,
        roles: seller?.roles,
        activeRole: seller?.activeRole
      };
    })
  );

  let sellers = sellersRaw;
  if (search) {
    const q = search.toLowerCase();
    sellers = sellers.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  }
  if (state) {
    const q = state.toLowerCase();
    sellers = sellers.filter((s) => (s.location || '').toLowerCase().includes(q));
  }
  if (year) {
    const yr = Number(year);
    if (!Number.isNaN(yr)) sellers = sellers.filter((s) => s.sellerYear >= yr);
  }
  if (minRating) {
    const mr = Number(minRating);
    if (!Number.isNaN(mr)) sellers = sellers.filter((s) => s.rating >= mr);
  }

  return NextResponse.json(
    {
      success: true,
      data: sellers,
      pagination: { page, limit, total: sellers.length || total }
    },
    { status: 200 }
  );
}
