// src/lib/auth.ts
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export interface TokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  role?: string;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded === 'string') {
      return null; // reject string payloads
    }
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}
