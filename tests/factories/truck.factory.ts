import Truck from '@/models/truck';
import mongoose from 'mongoose';

export interface CreateTruckOptions {
  plateNumber?: string;
  model?: string;
  capacity?: string;
  tracker?: string;
  images?: string[];
  transporter?: mongoose.Types.ObjectId | string;
  assignedDriver?: mongoose.Types.ObjectId | string;
  route?: {
    fromState?: string;
    toState?: string;
  };
}

/**
 * Create a truck
 */
export async function createTruck(options: CreateTruckOptions = {}) {
  const {
    plateNumber = `ABC-${Math.floor(Math.random() * 1000)}XY`,
    model = 'Mercedes Actros',
    capacity = '20 tons',
    tracker = `TRK-${Date.now()}`,
    images = [],
    transporter,
    route = { fromState: 'Lagos', toState: 'Abuja' },
    ...rest
  } = options;

  if (!transporter) {
    throw new Error('Truck transporter is required');
  }

  const truck = await Truck.create({
    plateNumber,
    model,
    capacity,
    tracker,
    images,
    transporter,
    route,
    ...rest,
  });

  return truck;
}

/**
 * Create multiple trucks
 */
export async function createTrucks(
  count: number,
  transporter: mongoose.Types.ObjectId | string,
  options: Omit<CreateTruckOptions, 'transporter'> = {}
) {
  const trucks = [];
  for (let i = 0; i < count; i++) {
    trucks.push(await createTruck({ ...options, transporter }));
  }
  return trucks;
}
