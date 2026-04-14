import Order from '@/models/order';
import Product from '@/models/product';
import { convertQuantityToKg } from '@/lib/shipmentWeight';

type ShipmentSnapshot = {
  orderId: any;
  productId: any;
  productName: string | null;
  quantity: number | null;
  unit: string;
  unitWeightKg?: number | null;
  loadWeightKg: number;
  loadWeightTonnes: number;
};

type ShipmentResolutionResult =
  | {
      ok: true;
      loadWeightKg: number;
      shipmentItems: ShipmentSnapshot[];
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveOrderLineUnit(line: any): { unit: string; unitWeightKg: number | null } {
  const lineUnit = typeof line?.unit === 'string' ? line.unit.trim().toLowerCase() : '';
  const lineUnitWeightKg = Number(line?.unitWeightKg);
  const productUnit = typeof line?.product?.unit === 'string' ? line.product.unit.trim().toLowerCase() : '';
  const productUnitWeightKg = Number(line?.product?.unitWeightKg);

  const hasLineSnapshot =
    !!lineUnit &&
    (
      lineUnit !== 'kg' ||
      (Number.isFinite(lineUnitWeightKg) && lineUnitWeightKg > 0)
    );

  if (hasLineSnapshot) {
    return {
      unit: lineUnit,
      unitWeightKg: Number.isFinite(lineUnitWeightKg) && lineUnitWeightKg > 0 ? lineUnitWeightKg : null
    };
  }

  if (productUnit) {
    return {
      unit: productUnit,
      unitWeightKg: Number.isFinite(productUnitWeightKg) && productUnitWeightKg > 0 ? productUnitWeightKg : null
    };
  }

  return {
    unit: lineUnit || 'kg',
    unitWeightKg: Number.isFinite(lineUnitWeightKg) && lineUnitWeightKg > 0 ? lineUnitWeightKg : null
  };
}

export function buildShipmentLoadMeta(loadWeightKg: unknown) {
  const numericLoadWeightKg = Number(loadWeightKg);
  if (!Number.isFinite(numericLoadWeightKg) || numericLoadWeightKg <= 0) {
    return {
      loadWeightKg: null,
      loadWeightTonnes: null,
      equivalent50kgBags: null,
      equivalent100kgBags: null,
      loadDisplay: null
    };
  }

  return {
    loadWeightKg: numericLoadWeightKg,
    loadWeightTonnes: roundMetric(numericLoadWeightKg / 1000),
    equivalent50kgBags: roundMetric(numericLoadWeightKg / 50),
    equivalent100kgBags: roundMetric(numericLoadWeightKg / 100),
    loadDisplay:
      numericLoadWeightKg >= 1000
        ? `${roundMetric(numericLoadWeightKg / 1000)} tonnes`
        : `${numericLoadWeightKg} kg`
  };
}

export async function resolveFleetShipmentSelection({
  buyerId,
  shipmentItems,
  explicitLoadWeightKg
}: {
  buyerId: any;
  shipmentItems: any;
  explicitLoadWeightKg?: unknown;
}): Promise<ShipmentResolutionResult> {
  let loadWeightKg = Number(explicitLoadWeightKg);
  const snapshots: ShipmentSnapshot[] = [];

  if (Array.isArray(shipmentItems) && shipmentItems.length > 0) {
    if (Number.isFinite(loadWeightKg) && loadWeightKg > 0) {
      return {
        ok: false,
        status: 400,
        message: 'Do not send loadWeightKg when shipmentItems are provided. The backend derives total load from the selected order quantities.'
      };
    }

    const orderIds = Array.from(new Set(shipmentItems.map((item: any) => String(item?.orderId || '')).filter(Boolean)));

    const orders = await Order.find({
      _id: { $in: orderIds },
      buyer: buyerId,
      status: 'paid',
      transportStatus: 'pending'
    }).populate({
      path: 'products.product',
      model: Product,
      select: '_id name unit unitWeightKg'
    });

    if (orders.length !== orderIds.length) {
      return {
        ok: false,
        status: 400,
        message: 'One or more selected orders are not paid, not pending for transport, or do not belong to the buyer'
      };
    }

    const ordersMap = new Map(orders.map((order: any) => [order._id.toString(), order]));
    let computedLoadWeightKg = 0;

    for (const item of shipmentItems) {
      const orderId = String(item?.orderId || '');
      const productId = String(item?.productId || '');
      const quantity = Number(item?.quantity ?? item?.quantityToShip);
      const itemUnitWeightKg = item?.unitWeightKg ?? item?.bagWeightKg;

      if (
        !orderId ||
        !productId ||
        (!Number.isFinite(quantity) || quantity <= 0)
      ) {
        return {
          ok: false,
          status: 400,
          message: 'Each shipment item must include valid orderId, productId, and quantity.'
        };
      }

      const order: any = ordersMap.get(orderId);
      if (!order) {
        return {
          ok: false,
          status: 400,
          message: 'Selected shipment order not found'
        };
      }

      const line = (order.products || []).find((entry: any) => {
        const lineProductId = entry?.product?._id?.toString?.() || entry?.product?.toString?.();
        return lineProductId === productId;
      });

      if (!line) {
        return {
          ok: false,
          status: 400,
          message: 'Selected shipment product does not belong to the specified order'
        };
      }

      if (quantity > Number(line.quantity || 0)) {
        return {
          ok: false,
          status: 400,
          message: 'Selected shipment quantity exceeds the order quantity for one or more items'
        };
      }

      const resolvedUnit = resolveOrderLineUnit(line);
      const unit = resolvedUnit.unit;
      const effectiveUnitWeightKg =
        Number(itemUnitWeightKg) > 0 ? itemUnitWeightKg : resolvedUnit.unitWeightKg;
      let itemLoadWeightKg: number | null = null;
      let snapshotQuantity: number | null = Number.isFinite(quantity) && quantity > 0 ? quantity : null;
      itemLoadWeightKg = convertQuantityToKg(quantity, unit, effectiveUnitWeightKg);

      if (itemLoadWeightKg === null) {
        return {
          ok: false,
          status: 400,
          message: `Unsupported shipment unit for capacity check: ${unit}. Use kg, tonne, 50kg_bag, or 100kg_bag.`
        };
      }

      snapshots.push({
        orderId: order._id,
        productId: line.product._id,
        productName: line.product.name || null,
        quantity: snapshotQuantity,
        unit,
        unitWeightKg: effectiveUnitWeightKg ?? null,
        loadWeightKg: itemLoadWeightKg,
        loadWeightTonnes: roundMetric(itemLoadWeightKg / 1000)
      });
      computedLoadWeightKg += itemLoadWeightKg;
    }

    loadWeightKg = computedLoadWeightKg;
  }

  if (!Number.isFinite(loadWeightKg) || loadWeightKg <= 0) {
    return {
      ok: false,
      status: 400,
      message: 'Valid loadWeightKg or shipmentItems is required'
    };
  }

  return {
    ok: true,
    loadWeightKg,
    shipmentItems: snapshots
  };
}
