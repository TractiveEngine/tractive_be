import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import Order from '@/models/order';
import Product from '@/models/product';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ error: 'Only agents or admins can create farmers' }, { status: 403 });
  }

  const {
    name, phone, businessName, nin, businessCAC, address,
    country, state, lga, villageOrLocalMarket
  } = await request.json();

  const requiredFields = [
    { key: 'name', value: name },
    { key: 'phone', value: phone },
    { key: 'address', value: address },
    { key: 'state', value: state },
    { key: 'lga', value: lga },
    { key: 'villageOrLocalMarket', value: villageOrLocalMarket }
  ];
  const missing = requiredFields.filter((field) => !field.value);
  if (missing.length > 0) {
    return NextResponse.json({
      success: false,
      message: `Missing required fields: ${missing.map((field) => field.key).join(', ')}`
    }, { status: 400 });
  }

  const farmer = await Farmer.create({
    name,
    phone,
    businessName,
    nin,
    businessCAC,
    address,
    country,
    state,
    lga,
    villageOrLocalMarket,
    createdBy: user._id,
  });

  return NextResponse.json({ farmer }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');

  const query: Record<string, unknown> = { createdBy: user._id };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { name: regex },
      { phone: regex },
      { businessName: regex }
    ];
  }

  let dateRange: { $gte: Date; $lt: Date } | undefined;
  if (yearParam || monthParam) {
    const year = yearParam ? Number(yearParam) : NaN;
    const month = monthParam ? Number(monthParam) : NaN;
    if (Number.isNaN(year) || year < 1970) {
      return NextResponse.json({ error: 'Invalid year filter' }, { status: 400 });
    }
    if (monthParam && (Number.isNaN(month) || month < 1 || month > 12)) {
      return NextResponse.json({ error: 'Invalid month filter' }, { status: 400 });
    }
    if (monthParam && !yearParam) {
      return NextResponse.json({ error: 'Month filter requires year' }, { status: 400 });
    }
    if (monthParam) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      dateRange = { $gte: start, $lt: end };
    } else {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      dateRange = { $gte: start, $lt: end };
    }
  }

  const farmers = await Farmer.find(query).lean();
  if (!farmers.length) {
    return NextResponse.json({ farmers: [] }, { status: 200 });
  }

  const farmerIds = farmers.map((farmer) => farmer._id);
  const orderMatch: Record<string, unknown> = {};
  if (dateRange) {
    orderMatch.createdAt = dateRange;
  }

  const stats = await Order.aggregate([
    Object.keys(orderMatch).length ? { $match: orderMatch } : { $match: {} },
    { $unwind: '$products' },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'products.product',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: '$productDoc' },
    { $match: { 'productDoc.farmer': { $in: farmerIds } } },
    {
      $group: {
        _id: {
          farmer: '$productDoc.farmer',
          order: '$_id'
        },
        revenue: {
          $sum: { $multiply: ['$productDoc.price', '$products.quantity'] }
        }
      }
    },
    {
      $group: {
        _id: '$_id.farmer',
        revenue: { $sum: '$revenue' },
        ordersCount: { $sum: 1 }
      }
    }
  ]);

  const statsByFarmer = new Map(
    stats.map((entry) => [String(entry._id), entry])
  );

  const enriched = farmers.map((farmer) => {
    const stat = statsByFarmer.get(String(farmer._id));
    return {
      ...farmer,
      revenue: stat?.revenue ?? 0,
      ordersCount: stat?.ordersCount ?? 0
    };
  });

  return NextResponse.json({ farmers: enriched }, { status: 200 });
}
