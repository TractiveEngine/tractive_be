import { NextResponse } from 'next/server';
import dbConnect from './dbConnect';
import User from '@/models/user';
import { verifyToken } from './auth';

export type Role = 'buyer' | 'agent' | 'transporter' | 'admin';
type ApprovalAwareUser = {
  roles?: string[];
  activeRole?: Role | null;
  agentApprovalStatus?: string | null;
  transporterApprovalStatus?: string | null;
  tokenVersion?: number | null;
};

export async function getAuthUserFromToken(token: string | null | undefined) {
  await dbConnect();
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  const user = await User.findById(decoded.userId);
  if (!user) return null;
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return null;
  }
  return user;
}

export async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return getAuthUserFromToken(token);
}

export function isRoleApproved(user: ApprovalAwareUser | null | undefined, role: Role) {
  if (!user) return false;
  if (role === 'agent') return user.agentApprovalStatus === 'approved';
  if (role === 'transporter') return user.transporterApprovalStatus === 'approved';
  return true;
}

export function getRoleApprovalStatus(user: ApprovalAwareUser | null | undefined, role: Role) {
  if (!user) return null;
  if (role === 'agent') return user.agentApprovalStatus ?? null;
  if (role === 'transporter') return user.transporterApprovalStatus ?? null;
  return 'approved';
}

export function hasRole(user: ApprovalAwareUser | null | undefined, role: Role) {
  return !!user && Array.isArray(user.roles) && user.roles.includes(role) && isRoleApproved(user, role);
}

export function ensureActiveRole(user: ApprovalAwareUser | null | undefined, role: Role) {
  return user?.activeRole === role && hasRole(user, role);
}

export function getFirstAvailableRole(user: ApprovalAwareUser | null | undefined): Role | null {
  if (!user || !Array.isArray(user.roles)) return null;

  const orderedRoles: Role[] = ['buyer', 'agent', 'transporter', 'admin'];
  for (const role of orderedRoles) {
    if (hasRole(user, role)) {
      return role;
    }
  }

  return null;
}

export function authenticationRequiredResponse() {
  return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
}

export function roleAccessRequiredResponse(roles: Role | Role[]) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  const labels = roleList.map((role) => role.charAt(0).toUpperCase() + role.slice(1));
  const message =
    labels.length === 1
      ? `${labels[0]} access required`
      : `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]} access required`;
  return NextResponse.json({ success: false, message }, { status: 403 });
}

export function approvalRequiredResponse(role: Extract<Role, 'agent' | 'transporter'>) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return NextResponse.json(
    { success: false, message: `${label} account is awaiting admin approval` },
    { status: 403 }
  );
}
