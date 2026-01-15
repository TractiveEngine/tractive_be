import { hash } from 'bcryptjs';
import User from '@/models/user';
import { signToken } from '@/lib/auth';

export type UserRole = 'buyer' | 'agent' | 'transporter' | 'admin';

export interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
  roles?: UserRole[];
  activeRole?: UserRole | null;
  isVerified?: boolean;
  phone?: string;
  businessName?: string;
  address?: string;
  country?: string;
  state?: string;
  status?: 'active' | 'suspended' | 'removed';
  agentApprovalStatus?: 'pending' | 'approved' | 'rejected' | null;
}

/**
 * Create a user with hashed password
 */
export async function createUser(options: CreateUserOptions = {}) {
  const {
    email = `user-${Date.now()}-${Math.random()}@example.com`,
    password = 'Password123!',
    name = 'Test User',
    roles = ['buyer'],
    activeRole = roles[0] || null,
    isVerified = true,
    ...rest
  } = options;

  const hashedPassword = await hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    roles,
    activeRole,
    isVerified,
    ...rest,
  });

  return {
    user,
    plainPassword: password,
    token: signToken({ userId: user._id.toString(), email: user.email, role: activeRole || roles[0] }),
  };
}

/**
 * Create a buyer user
 */
export async function createBuyer(options: Omit<CreateUserOptions, 'roles'> = {}) {
  return createUser({ ...options, roles: ['buyer'], activeRole: 'buyer' });
}

/**
 * Create an agent user
 */
export async function createAgent(options: Omit<CreateUserOptions, 'roles'> = {}) {
  return createUser({ 
    ...options, 
    roles: ['agent'], 
    activeRole: 'agent',
    agentApprovalStatus: 'approved'
  });
}

/**
 * Create a transporter user
 */
export async function createTransporter(options: Omit<CreateUserOptions, 'roles'> = {}) {
  return createUser({ ...options, roles: ['transporter'], activeRole: 'transporter' });
}

/**
 * Create an admin user
 */
export async function createAdmin(options: Omit<CreateUserOptions, 'roles'> = {}) {
  return createUser({ ...options, roles: ['admin'], activeRole: 'admin' });
}

/**
 * Create multiple users
 */
export async function createUsers(count: number, options: CreateUserOptions = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await createUser(options));
  }
  return users;
}
