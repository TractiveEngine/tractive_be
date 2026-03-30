import { parseCapacityToKg } from '@/lib/truckCapacity';

export const FLEET_PRICING_MODELS = [
  'flat_rate_whole_truck',
  'per_kg',
  'per_tonne',
  'per_50kg_bag',
  'per_100kg_bag'
] as const;

export type FleetPricingModel = typeof FLEET_PRICING_MODELS[number];

export function normalizeFleetPricingModel(value: unknown): FleetPricingModel {
  return FLEET_PRICING_MODELS.includes(value as FleetPricingModel)
    ? (value as FleetPricingModel)
    : 'flat_rate_whole_truck';
}

export function isWholeTruckPricingModel(value: unknown): boolean {
  return normalizeFleetPricingModel(value) === 'flat_rate_whole_truck';
}

function roundAmount(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function getFleetPricingUnitLabel(value: unknown): string {
  switch (normalizeFleetPricingModel(value)) {
    case 'per_kg':
      return 'per kg';
    case 'per_tonne':
      return 'per tonne';
    case 'per_50kg_bag':
      return 'per 50kg bag';
    case 'per_100kg_bag':
      return 'per 100kg bag';
    case 'flat_rate_whole_truck':
    default:
      return 'whole truck';
  }
}

export function getPricePerKgEquivalent(price: unknown, pricingModel: unknown, capacityKg?: unknown): number | null {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return null;
  }

  switch (normalizeFleetPricingModel(pricingModel)) {
    case 'per_kg':
      return roundAmount(numericPrice);
    case 'per_tonne':
      return roundAmount(numericPrice / 1000);
    case 'per_50kg_bag':
      return roundAmount(numericPrice / 50);
    case 'per_100kg_bag':
      return roundAmount(numericPrice / 100);
    case 'flat_rate_whole_truck': {
      const numericCapacityKg =
        typeof capacityKg === 'number' && Number.isFinite(capacityKg)
          ? capacityKg
          : parseCapacityToKg(capacityKg);
      if (!numericCapacityKg || numericCapacityKg <= 0) {
        return null;
      }
      return roundAmount(numericPrice / numericCapacityKg);
    }
    default:
      return null;
  }
}

export function buildFleetPricingMeta(truck: {
  price?: unknown;
  pricingModel?: unknown;
  capacity?: unknown;
  capacityKg?: unknown;
}) {
  const pricingModel = normalizeFleetPricingModel(truck.pricingModel);
  return {
    pricingModel,
    wholeTruckOnly: pricingModel === 'flat_rate_whole_truck',
    priceUnitLabel: getFleetPricingUnitLabel(pricingModel),
    pricePerKgEquivalent: getPricePerKgEquivalent(
      truck.price,
      pricingModel,
      typeof truck.capacityKg === 'number' && Number.isFinite(truck.capacityKg) ? truck.capacityKg : parseCapacityToKg(truck.capacity)
    )
  };
}

export function calculateFleetCharge(price: unknown, pricingModel: unknown, loadWeightKg: number): number | null {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return null;
  }
  if (!Number.isFinite(loadWeightKg) || loadWeightKg <= 0) {
    return null;
  }

  switch (normalizeFleetPricingModel(pricingModel)) {
    case 'per_kg':
      return roundAmount(numericPrice * loadWeightKg);
    case 'per_tonne':
      return roundAmount(numericPrice * (loadWeightKg / 1000));
    case 'per_50kg_bag':
      return roundAmount(numericPrice * (loadWeightKg / 50));
    case 'per_100kg_bag':
      return roundAmount(numericPrice * (loadWeightKg / 100));
    case 'flat_rate_whole_truck':
    default:
      return roundAmount(numericPrice);
  }
}
