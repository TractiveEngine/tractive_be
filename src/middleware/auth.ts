import { verifyToken } from '../lib/auth';

export function requireAuth(handler: any) {
  return async (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });

    req.user = decoded;
    return handler(req, res);
  };
}
