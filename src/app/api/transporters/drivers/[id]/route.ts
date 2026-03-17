import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const driver = await Driver.findOne({ _id: id, transporter: user._id });
  if (!driver) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  if (body.name !== undefined || body.fullName !== undefined) driver.name = body.name || body.fullName;
  if (body.phone !== undefined || body.phoneNumber !== undefined) driver.phone = body.phone || body.phoneNumber;
  if (body.licenseNumber !== undefined) driver.licenseNumber = body.licenseNumber;
  if (body.trackingNumber !== undefined) driver.trackingNumber = body.trackingNumber;

  const requestedTruckId = body.assignedTruck || body.truckId || body.fleetId;
  if (requestedTruckId !== undefined) {
    if (requestedTruckId === null || requestedTruckId === '') {
      if (driver.assignedTruck) {
        await Truck.updateOne(
          { _id: driver.assignedTruck, transporter: user._id },
          { $unset: { assignedDriver: 1 }, $set: { updatedAt: new Date() } }
        );
      }
      driver.assignedTruck = null;
    } else {
      const truck = await Truck.findOne({ _id: requestedTruckId, transporter: user._id });
      if (!truck) {
        return NextResponse.json({ success: false, message: 'Assigned fleet not found' }, { status: 404 });
      }
      if (truck.assignedDriver && truck.assignedDriver.toString() !== driver._id.toString()) {
        return NextResponse.json({ success: false, message: 'Assigned fleet is already linked to another driver' }, { status: 409 });
      }
      if (driver.assignedTruck && driver.assignedTruck.toString() !== truck._id.toString()) {
        await Truck.updateOne(
          { _id: driver.assignedTruck, transporter: user._id },
          { $unset: { assignedDriver: 1 }, $set: { updatedAt: new Date() } }
        );
      }
      driver.assignedTruck = truck._id;
      if (body.iot !== undefined || body.Iot !== undefined) {
        truck.iot = body.iot || body.Iot;
      }
      truck.assignedDriver = driver._id;
      truck.updatedAt = new Date();
      await truck.save();
    }
  } else if ((body.iot !== undefined || body.Iot !== undefined) && driver.assignedTruck) {
    await Truck.updateOne(
      { _id: driver.assignedTruck, transporter: user._id },
      { $set: { iot: body.iot || body.Iot, updatedAt: new Date() } }
    );
  }

  driver.updatedAt = new Date();
  await driver.save();
  await driver.populate({
    path: 'assignedTruck',
    select: '_id plateNumber fleetName fleetNumber iot model size capacity price priceNegotiation fleetDescription fleetStates route status images'
  });
  return NextResponse.json({ success: true, data: driver }, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const deleted = await Driver.findOne({ _id: id, transporter: user._id });
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }
  if (deleted.assignedTruck) {
    await Truck.updateOne(
      { _id: deleted.assignedTruck, transporter: user._id },
      { $unset: { assignedDriver: 1 }, $set: { updatedAt: new Date() } }
    );
  }
  await deleted.deleteOne();
  return NextResponse.json({ success: true, message: 'Driver removed' }, { status: 200 });
}
