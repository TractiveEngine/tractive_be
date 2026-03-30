import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import Truck from '@/models/truck';
import FleetBid from '@/models/fleetBid';
import FleetPayment from '@/models/fleetPayment';
import FleetBooking from '@/models/fleetBooking';
import { buildCapacityMeta } from '@/lib/truckCapacity';
import { calculateFleetCharge, getFleetPricingUnitLabel, isWholeTruckPricingModel } from '@/lib/fleetPricing';
import { resolveFleetShipmentSelection } from '@/lib/fleetShipment';

function resolveAcceptedAmount(bid: any) {
  return typeof bid?.counterAmount === 'number' && bid.counterAmount > 0 ? bid.counterAmount : bid?.amount;
}

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
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).select('_id transporter plateNumber fleetName fleetNumber model price pricingModel wholeTruckOnly capacity capacityKg currentLoadKg');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const query: Record<string, unknown> = { fleet: fleet._id };
  if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else if (ensureActiveRole(user, 'transporter')) {
    if (fleet.transporter?.toString() !== user._id.toString()) {
      return NextResponse.json({ success: false, message: 'Not authorized for this fleet' }, { status: 403 });
    }
  } else if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Buyer, transporter, or admin access required' }, { status: 403 });
  }

  const payments = await FleetPayment.find(query)
    .populate('buyer', '_id name email phone')
    .populate('transporter', '_id name email phone businessName')
    .populate('fleetBid', '_id amount counterAmount status')
    .populate('booking', '_id status amount')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: payments }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).select('_id transporter plateNumber fleetName fleetNumber model price pricingModel wholeTruckOnly capacity capacityKg currentLoadKg');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  let loadWeightKg = Number(body?.loadWeightKg);
  let shipmentItems: Array<{
    orderId: any;
    productId: any;
    productName: string | null;
    quantity: number;
    unit: string;
    loadWeightKg: number;
  }> = [];

  const capacityMeta = buildCapacityMeta(fleet.toObject());
  const wholeTruckOnly = isWholeTruckPricingModel(fleet.pricingModel) || fleet.wholeTruckOnly === true;
  if (wholeTruckOnly && Number(fleet.currentLoadKg || 0) > 0) {
    return NextResponse.json({
      success: false,
      message: 'This fleet only accepts whole-truck bookings and is already reserved or in use',
      data: {
        pricingModel: fleet.pricingModel || 'flat_rate_whole_truck',
        wholeTruckOnly: true,
        priceUnitLabel: getFleetPricingUnitLabel(fleet.pricingModel),
        currentLoadKg: Number(fleet.currentLoadKg || 0),
        capacityKg: capacityMeta.capacityKg
      }
    }, { status: 409 });
  }
  if (wholeTruckOnly) {
    const existingWholeTruckBooking = await FleetBooking.findOne({
      fleet: fleet._id,
      status: { $in: ['pending_payment', 'confirmed'] }
    }).select('_id buyer status');
    if (existingWholeTruckBooking && existingWholeTruckBooking.buyer?.toString() !== user._id.toString()) {
      return NextResponse.json({
        success: false,
        message: 'This fleet already has an active whole-truck booking request',
        data: {
          pricingModel: fleet.pricingModel || 'flat_rate_whole_truck',
          wholeTruckOnly: true,
          bookingId: existingWholeTruckBooking._id,
          bookingStatus: existingWholeTruckBooking.status
        }
      }, { status: 409 });
    }
  }
  const paymentMethod = body?.paymentMethod;
  if (!['cash', 'bank_transfer', 'card'].includes(paymentMethod)) {
    return NextResponse.json({ success: false, message: 'Valid paymentMethod is required' }, { status: 400 });
  }

  let acceptedBid: any = null;
  if (body?.fleetBidId) {
    if (!mongoose.Types.ObjectId.isValid(body.fleetBidId)) {
      return NextResponse.json({ success: false, message: 'Invalid fleetBidId' }, { status: 400 });
    }
    acceptedBid = await FleetBid.findOne({
      _id: body.fleetBidId,
      fleet: fleet._id,
      buyer: user._id,
      status: 'accepted'
    });
    if (!acceptedBid) {
      return NextResponse.json({ success: false, message: 'Accepted fleet bid not found' }, { status: 404 });
    }
  } else {
    acceptedBid = await FleetBid.findOne({
      fleet: fleet._id,
      buyer: user._id,
      status: 'accepted'
    }).sort({ updatedAt: -1, createdAt: -1 });
  }

  const shipmentResolution = await resolveFleetShipmentSelection({
    buyerId: user._id,
    shipmentItems: body?.shipmentItems ?? acceptedBid?.shipmentItems,
    explicitLoadWeightKg: body?.loadWeightKg ?? acceptedBid?.loadWeightKg
  });
  if (!shipmentResolution.ok) {
    return NextResponse.json({ success: false, message: shipmentResolution.message }, { status: shipmentResolution.status });
  }
  loadWeightKg = shipmentResolution.loadWeightKg;
  shipmentItems = shipmentResolution.shipmentItems;

  if (
    capacityMeta.remainingCapacityKg !== null &&
    loadWeightKg > capacityMeta.remainingCapacityKg
  ) {
    return NextResponse.json({
      success: false,
      message: 'Selected load exceeds the truck remaining capacity',
      data: {
        requestedLoadKg: loadWeightKg,
        remainingCapacityKg: capacityMeta.remainingCapacityKg,
        remainingCapacityDisplay: capacityMeta.remainingCapacityDisplay
      }
    }, { status: 400 });
  }

  const payableAmount = acceptedBid
    ? resolveAcceptedAmount(acceptedBid)
    : calculateFleetCharge(fleet.price, fleet.pricingModel, loadWeightKg);
  if (typeof payableAmount !== 'number' || Number.isNaN(payableAmount) || payableAmount <= 0) {
    return NextResponse.json({
      success: false,
      message: 'No payable fleet amount found. Set fleet price or accept a fleet bid first.'
    }, { status: 400 });
  }

  if (body?.amount !== undefined && Number(body.amount) !== payableAmount) {
    return NextResponse.json({ success: false, message: 'Amount does not match the accepted fleet amount' }, { status: 400 });
  }

  const existingPayment = await FleetPayment.findOne({
    fleet: fleet._id,
    buyer: user._id,
    fleetBid: acceptedBid?._id || null,
    amount: payableAmount,
    loadWeightKg,
    status: { $in: ['pending', 'approved'] }
  })
    .populate('buyer', '_id name email phone')
    .populate('transporter', '_id name email phone businessName')
    .populate('fleetBid', '_id amount counterAmount status')
    .populate('booking', '_id status amount');

  if (existingPayment) {
    return NextResponse.json({
      success: true,
      data: existingPayment,
      message: 'Existing fleet payment returned'
    }, { status: 200 });
  }

  let booking = await FleetBooking.findOne({
    fleet: fleet._id,
    buyer: user._id,
    fleetBid: acceptedBid?._id || null,
    amount: payableAmount,
    loadWeightKg,
    status: { $in: ['pending_payment', 'confirmed'] }
  });

  if (!booking) {
    booking = await FleetBooking.create({
      fleet: fleet._id,
      transporter: fleet.transporter,
      buyer: user._id,
      fleetBid: acceptedBid?._id || null,
      amount: payableAmount,
      loadWeightKg,
      shipmentItems,
      wholeTruckOnly,
      status: 'pending_payment',
      note: typeof body?.note === 'string' ? body.note : null
    });
  }

  const payment = await FleetPayment.create({
    fleet: fleet._id,
    transporter: fleet.transporter,
    buyer: user._id,
    fleetBid: acceptedBid?._id || null,
    booking: booking._id,
    amount: payableAmount,
    loadWeightKg,
    shipmentItems,
    wholeTruckOnly,
    paymentMethod,
    note: typeof body?.note === 'string' ? body.note : null
  });

  booking.payment = payment._id;
  booking.updatedAt = new Date();
  await booking.save();

  await payment.populate('buyer', '_id name email phone');
  await payment.populate('transporter', '_id name email phone businessName');
  await payment.populate('fleetBid', '_id amount counterAmount status');
  await payment.populate('booking', '_id status amount');

  return NextResponse.json({ success: true, data: payment }, { status: 201 });
}
