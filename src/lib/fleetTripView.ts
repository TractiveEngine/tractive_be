import Product from '@/models/product';

function toIdString(value: any) {
  return value?.toString?.() || value || null;
}

export async function buildFleetTripPackages(bookingIds: any[]) {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return [];
  }

  const shipmentItems = bookingIds.flatMap((booking: any) => Array.isArray(booking?.shipmentItems) ? booking.shipmentItems : []);
  const productIds = Array.from(new Set(shipmentItems.map((item: any) => toIdString(item?.productId)).filter(Boolean)));
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name images unit unitWeightKg')
    .lean();
  const productMap = new Map(products.map((product: any) => [product._id.toString(), product]));

  return shipmentItems.map((item: any) => {
    const productId = toIdString(item?.productId);
    const product = productId ? productMap.get(productId) : null;
    return {
      productId,
      name: item?.productName || product?.name || 'Unknown product',
      image: Array.isArray(product?.images) && product.images.length > 0 ? product.images[0] : null,
      quantity: item?.quantity ?? null,
      unit: item?.unit || product?.unit || null,
      unitWeightKg: product?.unitWeightKg ?? null,
      loadWeightKg: item?.loadWeightKg ?? null
    };
  });
}

export function buildTransporterSummary(transporter: any) {
  if (!transporter || typeof transporter !== 'object') return null;
  return {
    id: transporter._id,
    name: transporter.name || transporter.businessName || 'Unknown',
    businessName: transporter.businessName || null,
    phone: transporter.phone || null,
    email: transporter.email || null,
    address: transporter.address || null,
    state: transporter.state || null,
    image: transporter.image || null
  };
}

export function buildBuyerSummaries(buyers: any[]) {
  if (!Array.isArray(buyers)) return [];
  return buyers.map((buyer: any) => ({
    id: buyer._id,
    name: buyer.name || buyer.businessName || 'Unknown',
    businessName: buyer.businessName || null,
    phone: buyer.phone || null,
    email: buyer.email || null,
    address: buyer.address || null,
    state: buyer.state || null,
    image: buyer.image || null
  }));
}

export function buildFleetSummary(fleet: any) {
  if (!fleet || typeof fleet !== 'object') return null;
  return {
    id: fleet._id,
    name: fleet.fleetName || fleet.fleetNumber || null,
    fleetName: fleet.fleetName || null,
    plateNumber: fleet.plateNumber || null,
    iotId: fleet.iot || fleet.tracker || null,
    model: fleet.model || null,
    image: Array.isArray(fleet.images) && fleet.images.length > 0 ? fleet.images[0] : null,
    route: fleet.route || null
  };
}
