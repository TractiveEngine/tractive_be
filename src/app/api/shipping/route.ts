import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ShippingRequest from '@/models/shipping';
import Product from '@/models/product';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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

// POST /api/shipping - Create shipping request
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can create shipping requests' }, { status: 403 });
  }

  try {
    const { 
      productId, 
      totalKG, 
      negotiable, 
      paymentMethod, 
      bankTransferDetails,
      negotiationPrice 
    } = await request.json();

    // Validate required fields
    if (!productId || !totalKG || !paymentMethod) {
      return NextResponse.json({ 
        error: 'Product ID, total KG, and payment method are required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
    }

    // Validate payment method
    const validPaymentMethods = ['transfer', 'card', 'deposit', 'cheque'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json({ 
        error: 'Invalid payment method. Must be one of: transfer, card, deposit, cheque' 
      }, { status: 400 });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Calculate total amount
    // totalAmount = price * (totalKG / productSizeInKG)
    const productSizeInKG = product.quantity || 1; // Using quantity as size in KG
    const totalAmount = product.price * (totalKG / productSizeInKG);

    // Create shipping request with product snapshot
    const shippingRequest = await ShippingRequest.create({
      buyer: user._id,
      product: product._id,
      productName: product.name,
      productImage: product.images && product.images.length > 0 ? product.images[0] : null,
      productSizeInKG: productSizeInKG,
      totalKG: totalKG,
      totalAmount: totalAmount,
      negotiable: negotiable || false,
      negotiationPrice: negotiationPrice || null,
      paymentMethod: paymentMethod,
      bankTransferDetails: bankTransferDetails || null,
      status: 'pending'
    });

    // Populate product details
    await shippingRequest.populate('product');

    return NextResponse.json({ 
      success: true, 
      data: shippingRequest 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating shipping request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/shipping - List shipping requests for authenticated buyer
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can view shipping requests' }, { status: 403 });
  }

  try {
    const shippingRequests = await ShippingRequest.find({ buyer: user._id })
      .populate('product')
      .populate('transporter', 'name email businessName')
      .sort({ createdAt: -1 });

    return NextResponse.json({ 
      success: true, 
      data: shippingRequests 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching shipping requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
