import Driver from '@/models/driver';
import mongoose from 'mongoose';

export interface CreateDriverOptions {
  name?: string;
  phone?: string;
  licenseNumber?: string;
  trackingNumber?: string;
  transporter?: mongoose.Types.ObjectId | string;
  assignedTruck?: mongoose.Types.ObjectId | string;
}

/**
 * Create a driver
 */
export async function createDriver(options: CreateDriverOptions = {}) {
  const {
    name = `Driver ${Date.now()}`,
    phone = `+234${Math.floor(Math.random() * 1000000000)}`,
    licenseNumber = `LIC-${Math.floor(Math.random() * 100000)}`,
    trackingNumber = `TRK-${Date.now()}`,
    transporter,
    ...rest
  } = options;

  if (!transporter) {
    throw new Error('Driver transporter is required');
  }

  const driver = await Driver.create({
    name,
    phone,
    licenseNumber,
    trackingNumber,
    transporter,
    ...rest,
  });

  return driver;
}

/**
 * Create multiple drivers
 */
export async function createDrivers(
  count: number,
  transporter: mongoose.Types.ObjectId | string,
  options: Omit<CreateDriverOptions, 'transporter'> = {}
) {
  const drivers = [];
  for (let i = 0; i < count; i++) {
    drivers.push(await createDriver({ ...options, transporter }));
  }
  return drivers;
}
