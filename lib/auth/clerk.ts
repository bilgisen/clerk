import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server';
import type { User as ClerkUser } from '@clerk/nextjs/dist/types/server';
import type { AuthObject } from '@clerk/nextjs/server';

export type User = ClerkUser;

export interface AuthSession {
  userId: string | null;
  sessionId: string | null;
  getToken: () => Promise<string | null>;
  user?: User | null;
}

export interface AuthResult extends AuthSession {
  user: User | null;
}

declare module '@clerk/nextjs/server' {
  interface AuthObject {
    userId: string | null;
    sessionId: string | null;
    getToken: () => Promise<string | null>;
    user?: User | null;
  }
}

export async function getAuth(): Promise<AuthSession> {
  const session = await clerkAuth();
  
  return {
    userId: session?.userId || null,
    sessionId: session?.sessionId || null,
    getToken: async () => {
      return (await session?.getToken?.()) || null;
    },
  };
}

export async function getAuthWithUser(): Promise<AuthResult> {
  const session = await clerkAuth();
  const user = await currentUser();
  
  return {
    userId: session?.userId || null,
    sessionId: session?.sessionId || null,
    user,
    getToken: async () => {
      return (await session?.getToken?.()) || null;
    },
  };
}

export async function getToken(): Promise<string | null> {
  const session = await clerkAuth();
  
  if (!session?.userId) {
    return null;
  }
  
  return (await session.getToken?.()) || null;
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await getAuth();
  if (!session.userId) {
    throw new Error('Authentication required');
  }
  return session;
}

export { currentUser };

// For backward compatibility
export const auth = getAuth;
