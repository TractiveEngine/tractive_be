import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetPayment from '@/models/fleetPayment';
import FleetBooking from '@/models/fleetBooking';
import Truck from '@/models/truck';
import { buildCapacityMeta } from '@/lib/truckCapacity';
import { isWholeTruckPricingModel } from '@/lib/fleetPricing';
import { createFleetTripFromBooking } from '@/lib/fleetTrip';

const ALLOWED_STATUS = ['approved', 'rejected', 'pending'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet payment id' }, { status: 400 });
  }

  const payment = await FleetPayment.findById(id);
  if (!payment) {
    return NextResponse.json({ success: false, message: 'Fleet payment not found' }, { status: 404 });
  }
  const previousStatus = payment.status;

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  if (payment.fleet && typeof payment.loadWeightKg === 'number' && payment.loadWeightKg > 0) {
    const fleet = await Truck.findById(payment.fleet).select('_id capacity capacityKg currentLoadKg pricingModel wholeTruckOnly');
    if (fleet) {
      const wholeTruckOnly = payment.wholeTruckOnly === true || fleet.wholeTruckOnly === true || isWholeTruckPricingModel(fleet.pricingModel);
      if (previousStatus !== 'approved' && status === 'approved') {
        const capacityMeta = buildCapacityMeta(fleet.toObject());
        if (wholeTruckOnly) {
          if (Number(fleet.currentLoadKg || 0) > 0) {
            return NextResponse.json({
              success: false,
              message: 'Fleet is already reserved for a whole-truck booking'
            }, { status: 409 });
          }
          fleet.currentLoadKg = Math.max(payment.loadWeightKg, Number(capacityMeta.capacityKg || 0));
        } else {
          if (
            capacityMeta.remainingCapacityKg !== null &&
            payment.loadWeightKg > capacityMeta.remainingCapacityKg
          ) {
            return NextResponse.json({
              success: false,
              message: 'Fleet does not have enough remaining capacity for this load',
              data: {
                requestedLoadKg: payment.loadWeightKg,
                remainingCapacityKg: capacityMeta.remainingCapacityKg,
                remainingCapacityDisplay: capacityMeta.remainingCapacityDisplay
              }
            }, { status: 400 });
          }
          fleet.currentLoadKg = Math.max(0, Number(fleet.currentLoadKg || 0) + payment.loadWeightKg);
        }
        fleet.updatedAt = new Date();
        await fleet.save();
      }

      if (previousStatus === 'approved' && status !== 'approved') {
        fleet.currentLoadKg = wholeTruckOnly
          ? 0
          : Math.max(0, Number(fleet.currentLoadKg || 0) - payment.loadWeightKg);
        fleet.updatedAt = new Date();
        await fleet.save();
      }
    }
  }

  payment.status = status;
  payment.approvedBy = user._id;
  payment.updatedAt = new Date();
  await payment.save();

  if (payment.booking) {
    const booking = await FleetBooking.findById(payment.booking);
    if (booking) {
      if (status === 'approved') booking.status = 'confirmed';
      if (status === 'rejected') booking.status = 'rejected';
      if (status === 'pending') booking.status = 'pending_payment';
      booking.updatedAt = new Date();
      await booking.save();

      if (
        status === 'approved' &&
        booking.wholeTruckOnly === true &&
        !booking.fleetTripId
      ) {
        await createFleetTripFromBooking({
          booking,
          payment,
          origin: null,
          destination: null,
          createdBy: user._id
        });
      }
    }
  }

  return NextResponse.json({ success: true, data: payment }, { status: 200 });
}
