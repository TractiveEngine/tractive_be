import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import mongoose from 'mongoose';

// GET /api/sellers/:id/reviews
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const objectId = new mongoose.Types.ObjectId(id);
  const stats = await Review.aggregate([
    { $match: { agent: objectId } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
  let totalReviews = 0;
  let weighted = 0;
  for (const row of stats) {
    const rating = Number(row._id);
    const count = Number(row.count) || 0;
    if (distribution[rating] !== undefined) distribution[rating] = count;
    totalReviews += count;
    weighted += rating * count;
  }
  const averageRating = totalReviews > 0 ? weighted / totalReviews : 0;

  return NextResponse.json({
    success: true,
    data: {
      averageRating,
      totalReviews,
      ratingDistribution: {
        '5_star': distribution[5],
        '4_star': distribution[4],
        '3_star': distribution[3],
        '2_star': distribution[2],
        '1_star': distribution[1]
      }
    }
  }, { status: 200 });
}

