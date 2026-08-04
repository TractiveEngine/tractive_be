export function convertQuantityToKg(quantity: unknown, unit: unknown, unitWeightKg?: unknown): number | null {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  const normalizedUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  const resolvedUnitWeightKg = Number(unitWeightKg);
  if (!normalizedUnit || normalizedUnit === 'kg' || normalizedUnit === 'kilogram' || normalizedUnit === 'kilograms') {
    if (Number.isFinite(resolvedUnitWeightKg) && resolvedUnitWeightKg > 1) {
      return qty * resolvedUnitWeightKg;
    }
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

  if (normalizedUnit === '50kg_bag') {
    return qty * 50;
  }

  if (normalizedUnit === '100kg_bag') {
    return qty * 100;
  }

  if (normalizedUnit === 'bag' || normalizedUnit === 'bags') {
    if (!Number.isFinite(resolvedUnitWeightKg) || resolvedUnitWeightKg <= 0) {
      return null;
    }
    return qty * resolvedUnitWeightKg;
  }

  return null;
}
