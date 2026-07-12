import { GET as getOrderTracking } from '@/app/api/transporters/orders/[orderId]/tracking/route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolved = await Promise.resolve(params);
  return getOrderTracking(request, { params: Promise.resolve({ orderId: resolved.id }) });
}
