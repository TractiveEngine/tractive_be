import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import { hasRole, isRoleApproved } from '@/lib/apiAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    'userId' in p &&
    typeof (p as JwtUserPayload).userId === 'string'
  );
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

export async function PATCH(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { activeRole } = await request.json();

  if (!activeRole) {
    return NextResponse.json(
      { error: 'activeRole is required' },
      { status: 400 }
    );
  }

  const user = await User.findById(userData.userId);
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Validate that user has this role
  if (!user.roles.includes(activeRole)) {
    return NextResponse.json(
      {
        error: `You don't have the '${activeRole}' role`,
        availableRoles: user.roles,
      },
      { status: 403 }
    );
  }

  if (!hasRole(user as any, activeRole)) {
    const message =
      activeRole === 'agent' || activeRole === 'transporter'
        ? `${activeRole} account is awaiting admin approval`
        : `You cannot switch to '${activeRole}' right now`;
    return NextResponse.json(
      {
        error: message,
        approvalRequired: activeRole === 'agent' || activeRole === 'transporter',
        approvalStatus:
          activeRole === 'agent'
            ? user.agentApprovalStatus
            : activeRole === 'transporter'
              ? user.transporterApprovalStatus
              : null
      },
      { status: 403 }
    );
  }

  // Update active role
  user.activeRole = activeRole;
  await user.save();

  return NextResponse.json({
    message: `Successfully switched to ${activeRole} role`,
    activeRole: user.activeRole,
    availableRoles: user.roles,
  }, { status: 200 });
}

// GET current role info
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const user = await User.findById(userData.userId);
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    activeRole: user.activeRole,
    availableRoles: user.roles,
    roleApprovals: {
      agent: user.roles.includes('agent')
        ? { approved: isRoleApproved(user as any, 'agent'), status: user.agentApprovalStatus ?? null }
        : null,
      transporter: user.roles.includes('transporter')
        ? { approved: isRoleApproved(user as any, 'transporter'), status: user.transporterApprovalStatus ?? null }
        : null
    }
  }, { status: 200 });
}
