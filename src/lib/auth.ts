// src/lib/auth.ts
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function signRefreshToken(payload: object) {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

export interface TokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  role?: string;
  type?: string;
  tokenVersion?: number;
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

export function verifyRefreshToken(token: string): TokenPayload | null {
  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'refresh') {
    return null;
  }
  return decoded;
}
