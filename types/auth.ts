import { NextRequest } from 'next/server';
import { ClerkAuthContext, GitHubOidcAuthContext } from '@/lib/types/auth';

export type AuthContextUnion = ClerkAuthContext | GitHubOidcAuthContext | { type: 'unauthorized' };

export interface AuthRequest extends NextRequest {
  authContext: AuthContextUnion;
}
