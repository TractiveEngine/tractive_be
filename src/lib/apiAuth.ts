import jwt from 'jsonwebtoken';
import dbConnect from './dbConnect';
import User from '@/models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export type Role = 'buyer' | 'agent' | 'transporter' | 'admin';

export async function getAuthUser(request: Request) {
  await dbConnect();

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string } | string;
    if (!decoded || typeof decoded === 'string' || !decoded.userId) return null;
    const user = await User.findById(decoded.userId);
    return user;
  } catch {
    return null;
  }
}

export function ensureActiveRole(user: { activeRole?: Role } | null | undefined, role: Role) {
  return user?.activeRole === role;
}
