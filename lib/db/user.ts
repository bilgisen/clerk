// lib/db/user.ts
import { db } from "@/db/server";   // <-- artık gerçek server db client
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { creditService } from "@/lib/services/credits/credit-service";

type CreateUserInput = {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
};

export async function createOrGetUser({
  clerkUserId,
  email,
  firstName = "",
  lastName = "",
  imageUrl = "",
}: CreateUserInput) {
  // Check if user already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (existingUser) {
    return { 
      success: true, 
      userId: existingUser.id, 
      isNew: false 
    };
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      clerkId: clerkUserId,
      email,
      firstName,
      lastName,
      imageUrl,
      role: 'MEMBER',
      isActive: true,
      permissions: ['read:books'],
      subscriptionStatus: 'TRIAL',
      credits: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning({ id: users.id });

  if (!newUser?.id) {
    throw new Error('Failed to create user');
  }

  // Award signup bonus
  try {
    await creditService.addCredits({
      userId: newUser.id,
      amount: 1000,
      reason: 'signup_bonus',
      idempotencyKey: `signup-bonus-${newUser.id}-${Date.now()}`,
      metadata: {
        source: 'clerk_webhook_signup',
        clerkUserId
      }
    });
  } catch (error) {
    console.error('Failed to award signup bonus:', error);
    // Don't fail the user creation if bonus fails
  }

  return { 
    success: true, 
    userId: newUser.id, 
    isNew: true 
  };
}
