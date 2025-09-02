import { User } from '@/db/schema';

// Core auth types used throughout the application
export type AuthType = 'session' | 'unauthorized';

export interface SessionUser extends Pick<User, 
  'id' | 'email' | 'firstName' | 'lastName' | 'imageUrl' | 'role' | 'emailVerified'
> {
  // Alias for imageUrl to support both image and imageUrl
  image?: string | null;
  roles?: string[];
  permissions?: string[];
}

export interface SessionAuthContext {
  type: 'session';
  user: SessionUser;
  sessionId: string;
  createdAt: string;
}

export interface UnauthorizedContext {
  type: 'unauthorized';
}

export type AuthContextUnion = SessionAuthContext | UnauthorizedContext;

export interface AuthRequest extends Request {
  authContext: AuthContextUnion;
}

// Type guards
export function isSessionAuthContext(context: AuthContextUnion): context is SessionAuthContext {
  return context.type === 'session';
}

export function isUnauthorizedContext(context: AuthContextUnion): context is UnauthorizedContext {
  return context.type === 'unauthorized';
}
