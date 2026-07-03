import { authenticationRequiredResponse, getAuthUser, ensureActiveRole, roleAccessRequiredResponse } from './apiAuth';

export async function requireAdmin(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return { error: authenticationRequiredResponse() };
  }
  if (!ensureActiveRole(user, 'admin') && !(user.roles || []).includes('admin')) {
    return { error: roleAccessRequiredResponse('admin') };
  }
  return { user };
}
