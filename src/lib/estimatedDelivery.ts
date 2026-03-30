export const ESTIMATED_DELIVERY_UNITS = ['hours', 'days'] as const;

export type EstimatedDeliveryUnit = typeof ESTIMATED_DELIVERY_UNITS[number];

export function normalizeEstimatedDeliveryUnit(value: unknown): EstimatedDeliveryUnit | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'hour' || normalized === 'hours' || normalized === 'hr' || normalized === 'hrs') {
    return 'hours';
  }
  if (normalized === 'day' || normalized === 'days') {
    return 'days';
  }
  return null;
}

export function buildEstimatedDeliveryMeta(truck: {
  estimatedDeliveryValue?: unknown;
  estimatedDeliveryUnit?: unknown;
}) {
  const value = Number(truck.estimatedDeliveryValue);
  const unit = normalizeEstimatedDeliveryUnit(truck.estimatedDeliveryUnit);

  if (!Number.isFinite(value) || value <= 0 || !unit) {
    return {
      estimatedDeliveryValue: null,
      estimatedDeliveryUnit: null,
      estimatedDeliveryText: null
    };
  }

  const safeValue = Math.round(value * 100) / 100;
  const singular = unit === 'hours' ? 'hour' : 'day';
  const label = safeValue === 1 ? singular : unit;

  return {
    estimatedDeliveryValue: safeValue,
    estimatedDeliveryUnit: unit,
    estimatedDeliveryText: `${safeValue} ${label}`
  };
}
