import Farmer from '@/models/farmer';
import mongoose from 'mongoose';

export interface CreateFarmerOptions {
  name?: string;
  phone?: string;
  businessName?: string;
  nin?: string;
  businessCAC?: string;
  address?: string;
  country?: string;
  state?: string;
  lga?: string;
  villageOrLocalMarket?: string;
  createdBy?: mongoose.Types.ObjectId | string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  approvedBy?: mongoose.Types.ObjectId | string;
}

/**
 * Create a farmer
 */
export async function createFarmer(options: CreateFarmerOptions = {}) {
  const {
    name = `Farmer ${Date.now()}`,
    phone = `+234${Math.floor(Math.random() * 1000000000)}`,
    businessName = `Farm Business ${Date.now()}`,
    address = 'Test Farm Address',
    country = 'Nigeria',
    state = 'Lagos',
    lga = 'Ikeja',
    villageOrLocalMarket = 'Test Village',
    createdBy,
    approvalStatus = 'approved',
    ...rest
  } = options;

  if (!createdBy) {
    throw new Error('Farmer createdBy (agent) is required');
  }

  const farmer = await Farmer.create({
    name,
    phone,
    businessName,
    address,
    country,
    state,
    lga,
    villageOrLocalMarket,
    createdBy,
    approvalStatus,
    ...rest,
  });

  return farmer;
}

/**
 * Create multiple farmers
 */
export async function createFarmers(
  count: number,
  createdBy: mongoose.Types.ObjectId | string,
  options: Omit<CreateFarmerOptions, 'createdBy'> = {}
) {
  const farmers = [];
  for (let i = 0; i < count; i++) {
    farmers.push(await createFarmer({ ...options, createdBy }));
  }
  return farmers;
}
