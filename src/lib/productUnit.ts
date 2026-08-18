const PRODUCT_UNITS = ['kg', 'tonne', '50kg_bag', '100kg_bag'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export function isProductUnit(value: unknown): value is ProductUnit {
  return PRODUCT_UNITS.includes(value as ProductUnit);
}

export function normalizeProductUnit(value: unknown, unitWeightKg?: unknown): ProductUnit | null {
  if (typeof value !== 'string') return 'kg';
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilograms') {
    return 'kg';
  }

  if (['ton', 'tons', 'tonne', 'tonnes', 't'].includes(normalized)) {
    return 'tonne';
  }

  if (['50kg_bag', '50kg bag', '50kg bags', '50kg_bags'].includes(normalized)) {
    return '50kg_bag';
  }

  if (['100kg_bag', '100kg bag', '100kg bags', '100kg_bags'].includes(normalized)) {
    return '100kg_bag';
  }

  if (['bag', 'bags', 'packet', 'packets', 'pack', 'packs'].includes(normalized)) {
    const weight = Number(unitWeightKg);
    if (weight === 50) return '50kg_bag';
    if (weight === 100) return '100kg_bag';
    if (normalized === 'packet' || normalized === 'packets' || normalized === 'pack' || normalized === 'packs') {
      return 'kg';
    }
    return '50kg_bag';
  }

  return null;
}

export function getUnitWeightKg(unit: unknown, explicitUnitWeightKg?: unknown): number | null {
  const normalized = normalizeProductUnit(typeof unit === 'string' ? unit : 'kg', explicitUnitWeightKg);
  if (!normalized) return null;
  if (normalized === '50kg_bag') return 50;
  if (normalized === '100kg_bag') return 100;
  return null;
}

export function normalizeProductRecord<T extends { unit?: unknown; unitWeightKg?: unknown }>(record: T): T & {
  unit: ProductUnit;
  unitWeightKg: number | null;
} {
  const unit = normalizeProductUnit(record?.unit, record?.unitWeightKg) || 'kg';
  const unitWeightKg =
    record?.unitWeightKg !== undefined && record?.unitWeightKg !== null && record?.unitWeightKg !== ''
      ? Number(record.unitWeightKg)
      : getUnitWeightKg(unit);

  return {
    ...record,
    unit,
    unitWeightKg: Number.isFinite(unitWeightKg as number) && Number(unitWeightKg) > 0 ? Number(unitWeightKg) : null
  };
}

export function getLegacyCompatibleUnitOptions() {
  return ['kg', 'tonne', '50kg_bag', '100kg_bag', 'bag', 'bags', 'packet', 'packets'];
}

export function getProductUnitLabel(unit: ProductUnit): string {
  switch (unit) {
    case 'tonne':
      return 'tonne';
    case '50kg_bag':
      return '50kg bag';
    case '100kg_bag':
      return '100kg bag';
    case 'kg':
    default:
      return 'kg';
  }
}
