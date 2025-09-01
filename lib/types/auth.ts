import { JwtPayload } from 'jsonwebtoken';

export type AuthType = 'session';

export interface SessionAuthContext {
  type: AuthType;
  userId: string;
  email?: string;
  sessionId: string;
}

export type AuthContext = SessionAuthContext;

export interface SessionClaims {
  sub: string;
  email?: string;
  exp: number;
  iat: number;
  sessionId: string;
  [key: string]: unknown;
}

export interface AuthError extends Error {
  status: number;
  code: string;
  message: string;
}
