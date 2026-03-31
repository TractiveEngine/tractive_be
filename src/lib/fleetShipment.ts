import Order from '@/models/order';
import Product from '@/models/product';
import { convertQuantityToKg } from '@/lib/shipmentWeight';

type ShipmentSnapshot = {
  orderId: any;
  productId: any;
  productName: string | null;
  quantity: number;
  unit: string;
  loadWeightKg: number;
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
      const quantity = Number(item?.quantity);
      const itemUnitWeightKg = item?.unitWeightKg ?? item?.bagWeightKg;

      if (!orderId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
        return {
          ok: false,
          status: 400,
          message: 'Each shipment item must include valid orderId, productId, and quantity'
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

      const unit = line?.product?.unit || 'kg';
      const effectiveUnitWeightKg =
        Number(itemUnitWeightKg) > 0 ? itemUnitWeightKg : line?.product?.unitWeightKg;
      const itemLoadWeightKg = convertQuantityToKg(quantity, unit, effectiveUnitWeightKg);
      if (itemLoadWeightKg === null) {
        return {
          ok: false,
          status: 400,
          message: `Unsupported shipment unit for capacity check: ${unit}. Use kg, ton/tons, or bag with unitWeightKg defined on the product or provided in shipmentItems[].unitWeightKg.`
        };
      }

      snapshots.push({
        orderId: order._id,
        productId: line.product._id,
        productName: line.product.name || null,
        quantity,
        unit,
        loadWeightKg: itemLoadWeightKg
      });
      computedLoadWeightKg += itemLoadWeightKg;
    }

    if (Number.isFinite(loadWeightKg) && loadWeightKg > 0 && loadWeightKg !== computedLoadWeightKg) {
      return {
        ok: false,
        status: 400,
        message: 'Provided loadWeightKg does not match the selected shipment items total'
      };
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
