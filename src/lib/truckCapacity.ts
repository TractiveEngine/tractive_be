export function parseCapacityToKg(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  if (normalized.includes('ton')) {
    return Math.round(amount * 1000);
  }
  if (normalized.includes('kg') || normalized.includes('kilogram')) {
    return Math.round(amount);
  }

  return Math.round(amount);
}

export function buildCapacityMeta(truck: {
  capacity?: unknown;
  capacityKg?: unknown;
  currentLoadKg?: unknown;
}) {
  const parsedCapacityKg =
    typeof truck.capacityKg === 'number' && Number.isFinite(truck.capacityKg)
      ? truck.capacityKg
      : parseCapacityToKg(truck.capacity);
  const currentLoadKg =
    typeof truck.currentLoadKg === 'number' && Number.isFinite(truck.currentLoadKg)
      ? Math.max(0, truck.currentLoadKg)
      : null;
  const remainingCapacityKg =
    parsedCapacityKg !== null && currentLoadKg !== null
      ? Math.max(0, parsedCapacityKg - currentLoadKg)
      : null;

  return {
    capacityKg: parsedCapacityKg,
    currentLoadKg,
    remainingCapacityKg,
    remainingCapacityDisplay:
      remainingCapacityKg === null
        ? null
        : remainingCapacityKg >= 1000
          ? `${Number((remainingCapacityKg / 1000).toFixed(2))} tons`
          : `${remainingCapacityKg} kg`,
  };
}
