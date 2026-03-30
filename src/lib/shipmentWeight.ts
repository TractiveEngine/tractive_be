export function convertQuantityToKg(quantity: unknown, unit: unknown, unitWeightKg?: unknown): number | null {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  const normalizedUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  if (!normalizedUnit || normalizedUnit === 'kg' || normalizedUnit === 'kilogram' || normalizedUnit === 'kilograms') {
    return qty;
  }

  if (
    normalizedUnit === 'ton' ||
    normalizedUnit === 'tons' ||
    normalizedUnit === 'tonne' ||
    normalizedUnit === 'tonnes' ||
    normalizedUnit === 't'
  ) {
    return qty * 1000;
  }

  if (normalizedUnit === 'bag' || normalizedUnit === 'bags') {
    const bagWeightKg = Number(unitWeightKg);
    if (!Number.isFinite(bagWeightKg) || bagWeightKg <= 0) {
      return null;
    }
    return qty * bagWeightKg;
  }

  return null;
}
