import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { buildCapacityMeta, parseCapacityToKg } from '@/lib/truckCapacity';
import { buildFleetPricingMeta, normalizeFleetPricingModel } from '@/lib/fleetPricing';
import { buildEstimatedDeliveryMeta, normalizeEstimatedDeliveryUnit } from '@/lib/estimatedDelivery';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const truck = await Truck.findOne({ _id: id, transporter: user._id });
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }

  const truckObj = truck.toObject();
  return NextResponse.json({
    success: true,
    data: {
      ...truckObj,
      ...buildCapacityMeta(truckObj),
      ...buildFleetPricingMeta(truckObj),
      ...buildEstimatedDeliveryMeta(truckObj)
    }
  }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  if (body.name && !body.fleetName) body.fleetName = body.name;
  if (body.Iot && !body.iot) body.iot = body.Iot;
  if (body.capacityKg === undefined && (body.capacity !== undefined || body.size !== undefined)) {
    body.capacityKg = parseCapacityToKg(body.capacity || body.size);
  }
  const existingTruck = await Truck.findOne({ _id: id, transporter: user._id });
  if (!existingTruck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  if (body.estimatedDeliveryUnit !== undefined) {
    const normalizedEstimatedDeliveryUnit = normalizeEstimatedDeliveryUnit(body.estimatedDeliveryUnit);
    if (!normalizedEstimatedDeliveryUnit) {
      return NextResponse.json({ success: false, message: 'estimatedDeliveryUnit must be either hours or days' }, { status: 400 });
    }
    body.estimatedDeliveryUnit = normalizedEstimatedDeliveryUnit;
  }
  if (body.estimatedDeliveryValue !== undefined && body.estimatedDeliveryValue !== null) {
    const estimatedDeliveryValue = Number(body.estimatedDeliveryValue);
    if (!Number.isFinite(estimatedDeliveryValue) || estimatedDeliveryValue <= 0) {
      return NextResponse.json({ success: false, message: 'estimatedDeliveryValue must be a positive number' }, { status: 400 });
    }
    body.estimatedDeliveryValue = estimatedDeliveryValue;
    if (body.estimatedDeliveryUnit === undefined && !normalizeEstimatedDeliveryUnit(existingTruck?.estimatedDeliveryUnit)) {
      return NextResponse.json({ success: false, message: 'estimatedDeliveryUnit must be either hours or days' }, { status: 400 });
    }
  }
  if (body.pricingModel !== undefined) {
    body.pricingModel = normalizeFleetPricingModel(body.pricingModel);
    body.wholeTruckOnly = body.pricingModel === 'flat_rate_whole_truck';
  }

  const effectivePricingModel = normalizeFleetPricingModel(body.pricingModel ?? existingTruck.pricingModel);
  const effectiveCapacityKg =
    body.capacityKg !== undefined
      ? body.capacityKg
      : typeof existingTruck.capacityKg === 'number'
        ? existingTruck.capacityKg
        : parseCapacityToKg(existingTruck.capacity || existingTruck.size);
  if (effectivePricingModel === 'flat_rate_whole_truck' && (effectiveCapacityKg === null || effectiveCapacityKg <= 0)) {
    return NextResponse.json({
      success: false,
      message: 'capacity or capacityKg is required for flat-rate whole-truck fleets'
    }, { status: 400 });
  }

  const truck = await Truck.findOneAndUpdate(
    { _id: id, transporter: user._id },
    { ...body, updatedAt: new Date() },
    { new: true }
  );
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  const truckObj = truck.toObject();
  return NextResponse.json({
    success: true,
    data: {
      ...truckObj,
      ...buildCapacityMeta(truckObj),
      ...buildFleetPricingMeta(truckObj),
      ...buildEstimatedDeliveryMeta(truckObj)
    }
  }, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const deleted = await Truck.findOneAndDelete({ _id: id, transporter: user._id });
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Truck removed' }, { status: 200 });
}
