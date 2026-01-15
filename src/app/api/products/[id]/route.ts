import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import User from '@/models/user';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Shape of the JWT you issue (adjust if you use `sub` instead of `userId`)
type JwtUserPayload = JwtPayload & {
  userId: string;
  email?: string;
  role?: string;
};

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') return null;

    // If you use `sub` in your tokens, uncomment the 3 lines below:
    // const idFromSub = typeof decoded.sub === 'string' ? decoded.sub : undefined;
    // const uid = (decoded as JwtUserPayload).userId ?? idFromSub;
    // if (!uid) return null;

    if (typeof (decoded as JwtUserPayload).userId !== 'string') return null; // guard
    return decoded as JwtUserPayload;
  } catch {
    return null;
  }
}

// GET /api/products/[id]
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json({ product }, { status: 200 });
}

// PATCH /api/products/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.some((r: string) => ['admin', 'agent'].includes(r))) {
    return NextResponse.json({ error: 'Only admin or agent can update products' }, { status: 403 });
  }

  const body = await request.json();
  const product = await Product.findByIdAndUpdate(id, body, { new: true });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product }, { status: 200 });
}

// DELETE /api/products/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.some((r: string) => ['admin', 'agent'].includes(r))) {
    return NextResponse.json({ error: 'Only admin or agent can delete products' }, { status: 403 });
  }

  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
}

