import dbConnect from './dbConnect';
import User from '@/models/user';
import { verifyToken } from './auth';

export type Role = 'buyer' | 'agent' | 'transporter' | 'admin';
type ApprovalAwareUser = {
  roles?: string[];
  activeRole?: Role | null;
  agentApprovalStatus?: string | null;
  transporterApprovalStatus?: string | null;
};

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

export function isRoleApproved(user: ApprovalAwareUser | null | undefined, role: Role) {
  if (!user) return false;
  if (role === 'agent') return user.agentApprovalStatus === 'approved';
  if (role === 'transporter') return user.transporterApprovalStatus === 'approved';
  return true;
}

export function hasRole(user: ApprovalAwareUser | null | undefined, role: Role) {
  return !!user && Array.isArray(user.roles) && user.roles.includes(role) && isRoleApproved(user, role);
}

export function ensureActiveRole(user: ApprovalAwareUser | null | undefined, role: Role) {
  return user?.activeRole === role && hasRole(user, role);
}
