import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import Truck from '@/models/truck';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/transporters/dashboard - Get transporter dashboard metrics
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can view dashboard' }, { status: 403 });
  }

  try {
    // Get all transactions where transporter is involved
    // Note: The current Transaction model doesn't have a payeeId field
    // We'll calculate based on orders assigned to this transporter
    const allOrders = await Order.find({ transporter: user._id });
    const orderIds = allOrders.map(order => order._id);

    // Get transactions for these orders
    const transactions = await Transaction.find({ 
      order: { $in: orderIds }
    });

    // Calculate total revenue from approved transactions
    const totalRevenue = transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    // Count active orders (pending, paid, not delivered)
    const activeOrders = allOrders.filter(order => 
      order.status !== 'delivered' && order.transportStatus !== 'delivered'
    ).length;

    // Count completed orders (delivered)
    const completedOrders = allOrders.filter(order => 
      order.status === 'delivered' || order.transportStatus === 'delivered'
    ).length;

    // Get fleet information
    const trucks = await Truck.find({ transporter: user._id });
    const totalFleet = trucks.length;

    // Calculate fleet status (simplified - based on whether assigned to driver)
    const fleetStatus = {
      available: trucks.filter(t => !t.assignedDriver).length,
      on_transit: trucks.filter(t => t.assignedDriver).length,
      under_maintenance: 0 // This would need a maintenance field in the Truck model
    };

    // Get unique buyers served
    const uniqueBuyerIds = new Set(allOrders.map(order => order.buyer.toString()));
    const customersServed = uniqueBuyerIds.size;

    return NextResponse.json({ 
      success: true, 
      data: {
        totalRevenue,
        activeOrders,
        completedOrders,
        totalFleet,
        fleetStatus,
        customersServed
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
