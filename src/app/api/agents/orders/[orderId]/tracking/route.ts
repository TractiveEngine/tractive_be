import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getAgentOrderView } from '@/lib/agentPortal';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Agent access required' }, { status: 403 });
  }

  const { orderId } = await Promise.resolve(params);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await getAgentOrderView(user._id.toString(), orderId);
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      pickedAt: order.pickedAt || null,
      onTransitAt: order.onTransitAt || null,
      deliveredAt: order.deliveredAt || null,
      estDeliveryDate: order.estDeliveryDate || null,
      fromState: order.fromState || null,
      toState: order.toState || null,
      mapMarkers: order.mapMarkers || []
    }
  }, { status: 200 });
}
