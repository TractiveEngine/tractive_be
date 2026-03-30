import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import Review from '@/models/review';
import Order from '@/models/order';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import { buildCapacityMeta } from '@/lib/truckCapacity';
import { buildFleetPricingMeta } from '@/lib/fleetPricing';
import { buildEstimatedDeliveryMeta } from '@/lib/estimatedDelivery';
import { getFleetBidSummaries } from '@/lib/fleetBidSummary';

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

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const availability = searchParams.get('availability');
  const fromState = searchParams.get('fromState');
  const toState = searchParams.get('toState');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const size = searchParams.get('size');
  const pricingModel = searchParams.get('pricingModel');

  const fleetQuery: Record<string, unknown> = { transporter: transporter._id };
  if (search) {
    const regex = new RegExp(search, 'i');
    fleetQuery.$or = [
      { plateNumber: regex },
      { fleetName: regex },
      { fleetNumber: regex },
      { model: regex },
      { iot: regex }
    ];
  }
  const effectiveStatus = availability || status;
  if (effectiveStatus) {
    fleetQuery.status = effectiveStatus;
  }
  if (fromState) {
    fleetQuery['route.fromState'] = fromState;
  }
  if (toState) {
    fleetQuery['route.toState'] = toState;
  }
  if (size) {
    const sizeRegex = new RegExp(size, 'i');
    fleetQuery.$and = [
      ...(Array.isArray(fleetQuery.$and) ? fleetQuery.$and : []),
      { $or: [{ size: sizeRegex }, { capacity: sizeRegex }, { model: sizeRegex }, { fleetName: sizeRegex }] }
    ];
  }
  if (pricingModel) {
    fleetQuery.pricingModel = pricingModel;
  }
  if (year || month) {
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
    if (Object.keys(createdAt).length > 0) {
      fleetQuery.createdAt = createdAt;
    }
  }

  const [reviewAgg, deliveryAgg, driversCount, fleetCount, drivers, fleet, filteredFleetCount] = await Promise.all([
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
    Truck.countDocuments({ transporter: transporter._id }),
    Driver.find({ transporter: transporter._id })
      .select('_id name phone licenseNumber trackingNumber assignedTruck createdAt updatedAt')
      .populate({
        path: 'assignedTruck',
        select: '_id plateNumber fleetName fleetNumber iot model size capacity capacityKg currentLoadKg price pricingModel wholeTruckOnly estimatedDeliveryValue estimatedDeliveryUnit priceNegotiation fleetDescription fleetStates route status images'
      })
      .sort({ createdAt: -1 }),
    Truck.find(fleetQuery)
      .select('_id plateNumber fleetName fleetNumber iot model size capacity capacityKg currentLoadKg price pricingModel wholeTruckOnly estimatedDeliveryValue estimatedDeliveryUnit priceNegotiation fleetDescription fleetStates tracker route status images assignedDriver createdAt updatedAt')
      .populate({
        path: 'assignedDriver',
        select: '_id name phone licenseNumber trackingNumber'
      })
      .sort({ createdAt: -1 }),
    Truck.countDocuments(fleetQuery)
  ]);
  const bidSummaries = await getFleetBidSummaries(fleet.map((truck: any) => truck._id));

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
      filteredFleetCount,
      drivers: drivers.map((driver: any) => {
        const driverObj = driver.toObject();
        const assignedTruck = driverObj.assignedTruck
          ? {
              ...driverObj.assignedTruck,
              ...buildCapacityMeta(driverObj.assignedTruck),
              ...buildFleetPricingMeta(driverObj.assignedTruck),
              ...buildEstimatedDeliveryMeta(driverObj.assignedTruck)
            }
          : null;
        return { ...driverObj, assignedTruck };
      }),
      fleet: fleet.map((truck: any) => {
        const truckObj = truck.toObject();
        return {
          ...truckObj,
          ...buildCapacityMeta(truckObj),
          ...buildFleetPricingMeta(truckObj),
          ...buildEstimatedDeliveryMeta(truckObj),
          bidSummary: bidSummaries.get(truck._id.toString()) || null
        };
      }),
      fleetFilters: {
        search: search || null,
        status: effectiveStatus || null,
        availability: effectiveStatus || null,
        fromState: fromState || null,
        toState: toState || null,
        size: size || null,
        pricingModel: pricingModel || null,
        year: year ? Number(year) : null,
        month: month ? Number(month) : null,
      }
    }
  }, { status: 200 });
}
