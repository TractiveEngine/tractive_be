import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

function parseCapacityKg(fleet: any) {
  const explicitCapacityKg = Number(fleet.capacityKg);
  if (Number.isFinite(explicitCapacityKg) && explicitCapacityKg > 0) return explicitCapacityKg;

  const capacity = String(fleet.capacity || '').trim().toLowerCase();
  const match = capacity.match(/([\d.]+)\s*(tonnes?|tons?|kg)?/);
  if (!match) return 0;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return /ton/.test(match[2] || '') ? amount * 1000 : amount;
}

async function main() {
  const shouldWrite = process.argv.includes('--write');
  await mongoose.connect(MONGODB_URI);

  const { default: FleetTrip } = await import('../models/fleetTrip');
  const { default: FleetBooking } = await import('../models/fleetBooking');
  const { default: Truck } = await import('../models/truck');

  const trips = await FleetTrip.find({
    status: { $in: ['delivered', 'cancelled'] }
  }).select('_id fleet bookingIds status');
  const fleetIds = new Map<string, any>();
  let completedBookings = 0;
  let restoredBookings = 0;

  for (const trip of trips as any[]) {
    if (trip.fleet) fleetIds.set(String(trip.fleet), trip.fleet);
    const bookingIds = Array.isArray(trip.bookingIds) ? trip.bookingIds : [];
    if (bookingIds.length === 0) continue;

    const nextStatus = trip.status === 'delivered' ? 'completed' : 'confirmed';
    const affectedBookings = await FleetBooking.countDocuments({
      _id: { $in: bookingIds },
      status: { $ne: nextStatus }
    });
    if (trip.status === 'delivered') completedBookings += affectedBookings;
    else restoredBookings += affectedBookings;

    if (shouldWrite && affectedBookings > 0) {
      await FleetBooking.updateMany(
        { _id: { $in: bookingIds }, status: { $ne: nextStatus } },
        {
          $set: {
            status: nextStatus,
            fleetTripId: null,
            updatedAt: new Date()
          }
        }
      );
    }
  }

  let reconciledFleets = 0;
  for (const fleetId of fleetIds.values()) {
    const fleet = await Truck.findById(fleetId).select('_id capacity capacityKg wholeTruckOnly status');
    if (!fleet) continue;

    const confirmedBookings = await FleetBooking.find({ fleet: fleet._id, status: 'confirmed' })
      .select('loadWeightKg wholeTruckOnly');
    const activeTripCount = await FleetTrip.countDocuments({
      fleet: fleet._id,
      status: { $in: ['planned', 'loaded', 'on_transit', 'arrived'] }
    });
    const confirmedLoadKg = confirmedBookings.reduce(
      (sum: number, booking: any) => sum + Math.max(0, Number(booking.loadWeightKg || 0)),
      0
    );
    const hasWholeTruckBooking = confirmedBookings.some((booking: any) => booking.wholeTruckOnly === true);
    const currentLoadKg = hasWholeTruckBooking
      ? Math.max(confirmedLoadKg, parseCapacityKg(fleet))
      : confirmedLoadKg;
    const status = activeTripCount === 0 && fleet.status !== 'under_maintenance' ? 'available' : fleet.status;

    if (shouldWrite) {
      await Truck.updateOne(
        { _id: fleet._id },
        { $set: { currentLoadKg, status, updatedAt: new Date() } }
      );
    }
    reconciledFleets += 1;
  }

  console.log(`Delivered/cancelled trips checked: ${trips.length}`);
  console.log(`Bookings to complete from delivered trips: ${completedBookings}`);
  console.log(`Bookings to restore from cancelled trips: ${restoredBookings}`);
  console.log(`Fleets to reconcile: ${reconciledFleets}`);
  console.log(shouldWrite ? 'Write mode completed.' : 'Dry run only. Re-run with --write to persist changes.');
}

main()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fleet trip resource backfill failed:', error);
    mongoose.connection.close().finally(() => process.exit(1));
  });
