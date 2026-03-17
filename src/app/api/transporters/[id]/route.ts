import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import Review from '@/models/review';
import Order from '@/models/order';
import Driver from '@/models/driver';
import Truck from '@/models/truck';

// GET /api/transporters/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const transporter = await User.findById(id).select('_id name email phone businessName roles activeRole status image bio address country state createdAt');
  if (!transporter || !transporter.roles.includes('transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter not found' }, { status: 404 });
  }

  const [reviewAgg, deliveryAgg, driversCount, fleetCount] = await Promise.all([
    Review.aggregate([
      { $match: { agent: transporter._id } },
      {
        $group: {
          _id: '$agent',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]),
    Order.aggregate([
      { $match: { transporter: transporter._id, status: 'delivered' } },
      {
        $group: {
          _id: '$transporter',
          totalSales: { $sum: '$totalAmount' },
          deliveriesCount: { $sum: 1 }
        }
      }
    ]),
    Driver.countDocuments({ transporter: transporter._id }),
    Truck.countDocuments({ transporter: transporter._id })
  ]);

  const review = reviewAgg[0];
  const delivery = deliveryAgg[0];

  return NextResponse.json({
    success: true,
    data: {
      ...transporter.toObject(),
      location: transporter.state || transporter.address || null,
      rating: review?.averageRating ?? 0,
      reviewsCount: review?.totalReviews ?? 0,
      totalSales: delivery?.totalSales ?? 0,
      deliveriesCount: delivery?.deliveriesCount ?? 0,
      driversCount,
      fleetCount,
    }
  }, { status: 200 });
}
