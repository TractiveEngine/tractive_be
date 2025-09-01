// src/middleware/auth.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken, type TokenPayload } from '../lib/auth';

export type AuthedRequest = NextApiRequest & { user: TokenPayload };

export function requireAuth(
  handler: (req: AuthedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (req as AuthedRequest).user = payload;
    return handler(req as AuthedRequest, res);
  };
}
