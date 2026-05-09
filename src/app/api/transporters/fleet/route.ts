import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { buildCapacityMeta, parseCapacityToKg } from '@/lib/truckCapacity';
import { buildFleetPricingMeta, normalizeFleetPricingModel } from '@/lib/fleetPricing';
import { buildEstimatedDeliveryMeta, normalizeEstimatedDeliveryUnit } from '@/lib/estimatedDelivery';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const query: Record<string, unknown> = { transporter: user._id };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { plateNumber: regex },
      { fleetName: regex },
      { fleetNumber: regex },
      { model: regex },
      { iot: regex }
    ];
  }
  if (status) {
    query.status = status;
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
      query.createdAt = createdAt;
    }
  }

  const trucks = await Truck.find(query).sort({ createdAt: -1 });
  return NextResponse.json({
    success: true,
    data: trucks.map((truck) => {
      const truckObj = truck.toObject();
      return {
        ...truckObj,
        ...buildCapacityMeta(truckObj),
        ...buildFleetPricingMeta(truckObj),
        ...buildEstimatedDeliveryMeta(truckObj)
      };
    })
  }, { status: 200 });
}

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const body = await request.json();
  const plateNumber = body.plateNumber || body.fleetNumber;
  if (!plateNumber) {
    return NextResponse.json({ success: false, message: 'plateNumber or fleetNumber required' }, { status: 400 });
  }

  const pricingModel = normalizeFleetPricingModel(body.pricingModel);
  const estimatedDeliveryUnit = normalizeEstimatedDeliveryUnit(body.estimatedDeliveryUnit);
  const estimatedDeliveryValue =
    body.estimatedDeliveryValue !== undefined && body.estimatedDeliveryValue !== null
      ? Number(body.estimatedDeliveryValue)
      : null;
  const capacityTonnes =
    body.capacityTonnes !== undefined && body.capacityTonnes !== null
      ? Number(body.capacityTonnes)
      : null;
  const capacityKg =
    capacityTonnes !== null && Number.isFinite(capacityTonnes) && capacityTonnes > 0
      ? Math.round(capacityTonnes * 1000)
      : typeof body.capacityKg === 'number'
      ? body.capacityKg
      : parseCapacityToKg(body.capacity || body.size);
  if (pricingModel === 'flat_rate_whole_truck' && (capacityKg === null || capacityKg <= 0)) {
    return NextResponse.json({
      success: false,
      message: 'capacity or capacityKg is required for flat-rate whole-truck fleets'
    }, { status: 400 });
  }
  if (estimatedDeliveryValue !== null && (!Number.isFinite(estimatedDeliveryValue) || estimatedDeliveryValue <= 0)) {
    return NextResponse.json({ success: false, message: 'estimatedDeliveryValue must be a positive number' }, { status: 400 });
  }
  if (body.estimatedDeliveryValue !== undefined && !estimatedDeliveryUnit) {
    return NextResponse.json({ success: false, message: 'estimatedDeliveryUnit must be either hours or days' }, { status: 400 });
  }

  const truck = await Truck.create({
    plateNumber,
    fleetName: body.fleetName || body.name || body.model,
    fleetNumber: body.fleetNumber || plateNumber,
    iot: body.iot || body.Iot || body.tracker,
    model: body.model || body.fleetName || body.name,
    size: body.size,
    capacity: capacityTonnes !== null && Number.isFinite(capacityTonnes) && capacityTonnes > 0
      ? `${capacityTonnes} tonnes`
      : body.capacity || body.size,
    capacityKg,
    currentLoadKg:
      typeof body.currentLoadKg === 'number' && body.currentLoadKg >= 0
        ? body.currentLoadKg
        : 0,
    price: body.price,
    pricingModel,
    wholeTruckOnly: pricingModel === 'flat_rate_whole_truck',
    estimatedDeliveryValue,
    estimatedDeliveryUnit,
    priceNegotiation: !!body.priceNegotiation,
    images: Array.isArray(body.images) ? body.images : [],
    fleetDescription: body.fleetDescription,
    fleetStates: body.fleetStates,
    transporter: user._id,
    route: body.route || {
      fromState: body.fromState || null,
      toState: body.toState || null
    },
  });

  const truckObj = truck.toObject();
  return NextResponse.json({
    success: true,
    data: {
      ...truckObj,
      ...buildCapacityMeta(truckObj),
      ...buildFleetPricingMeta(truckObj),
      ...buildEstimatedDeliveryMeta(truckObj)
    }
  }, { status: 201 });
}
