import { auth, currentUser } from '@clerk/nextjs/server';
import type { User } from '@clerk/nextjs/server';

export interface ClerkAuthResult {
  userId: string | null;
  user: User | null;
  sessionId: string | null;
  getToken: () => Promise<string | null>;
}

export async function getClerkAuth(): Promise<ClerkAuthResult> {
  const session = await auth();
  const user = await currentUser();
  
  return {
    userId: session?.userId || null,
    user,
    sessionId: session?.sessionId || null,
    getToken: async () => {
      return session?.getToken() || null;
    },
  };
}

export function requireAuth() {
  const session = auth();
  if (!session.userId) {
    throw new Error('Authentication required');
  }
  return session;
}

export function getAuthToken() {
  const session = auth();
  return session.getToken();
}
