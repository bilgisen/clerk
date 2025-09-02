import { JwtPayload } from 'jsonwebtoken';
import { 
  AuthContextUnion, 
  SessionAuthContext, 
  AuthType 
} from '@/types/auth.types';

export type AuthContext = SessionAuthContext;

export interface AuthRequest extends Request {
  authContext: AuthContextUnion;
}

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
