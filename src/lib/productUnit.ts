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

  if (['bag', 'bags'].includes(normalized)) {
    const weight = Number(unitWeightKg);
    if (weight === 50) return '50kg_bag';
    if (weight === 100) return '100kg_bag';
  }

  return null;
}

export function getUnitWeightKg(unit: ProductUnit): number | null {
  if (unit === '50kg_bag') return 50;
  if (unit === '100kg_bag') return 100;
  return null;
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
