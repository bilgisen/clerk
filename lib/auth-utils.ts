// lib/auth-utils.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db/drizzle';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

type EnsureUserResult = {
  userId: string;
  isNewUser: boolean;
} | null;

export async function ensureUserInDatabase(): Promise<EnsureUserResult> {
  try {
    // Get the authenticated user from Clerk
    const session = await auth();
    
    if (!session.userId) {
      console.error('No authenticated user found');
      return null;
    }
    
    const clerkUserId = session.userId;
    const user = await currentUser();
    
    if (!user) {
      console.error('No user data available');
      return null;
    }

    // Check if user already exists in our database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId)
    });

    if (existingUser) {
      // User exists, return the user ID
      return {
        userId: existingUser.id,
        isNewUser: false
      };
    }

    // User doesn't exist, create a new user record
    const [newUser] = await db.insert(users).values({
      clerkId: clerkUserId,
      email: user.emailAddresses[0]?.emailAddress ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      imageUrl: user.imageUrl ?? '',
      isActive: true,
    }).returning({ id: users.id });

    if (!newUser) {
      console.error('Failed to create user in database');
      return null;
    }

    return {
      userId: newUser.id,
      isNewUser: true
    };
  } catch (error) {
    console.error('Error in ensureUserInDatabase:', error);
    return null;
  }
}
