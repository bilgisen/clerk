import { NextRequest } from 'next/server';
import { SessionAuthContext } from '@/lib/types/auth';

export type AuthContextUnion = SessionAuthContext | { type: 'unauthorized' };

export interface AuthRequest extends NextRequest {
  authContext: AuthContextUnion;
}
