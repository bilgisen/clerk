import { NextRequest } from 'next/server';
import { AuthContextUnion } from './auth.types';

export interface AuthRequest extends NextRequest {
  authContext: AuthContextUnion;
}
