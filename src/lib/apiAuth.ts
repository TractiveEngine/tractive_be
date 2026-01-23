import dbConnect from './dbConnect';
import User from '@/models/user';
import { verifyToken } from './auth';

export type Role = 'buyer' | 'agent' | 'transporter' | 'admin';

export async function getAuthUser(request: Request) {
  await dbConnect();

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  const user = await User.findById(decoded.userId);
  if (!user) return null;
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return null;
  }
  return user;
}

export function ensureActiveRole(user: { activeRole?: Role } | null | undefined, role: Role) {
  return user?.activeRole === role;
}
