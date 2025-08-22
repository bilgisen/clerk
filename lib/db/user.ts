import { db } from "@/lib/db/server";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type CreateUserInput = {
  clerkId: string;
  email: string;
  name?: string | null;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
};

export async function createOrGetUser({
  clerkId,
  email,
  name,
  firstName = "",
  lastName = "",
  imageUrl = "",
}: CreateUserInput) {
  // 1. Check by clerkId first (most important)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (existingUser) {
    return { 
      user: existingUser, 
      isNew: false,
      userId: existingUser.id,
      success: true
    };
  }

  // 2. Check for email duplicates (just for logging)
  if (email) {
    const emailDuplicate = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (emailDuplicate) {
      console.warn(
        `[User Merge Needed] Email ${email} already exists with userId=${emailDuplicate.id} but different clerkId: ${clerkId}`
      );
      // In production, you might want to merge these accounts or handle this case
    }
  }

  // 3. Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      clerkId,
      email: email || `${clerkId}@temporary-email.com`,
      firstName: name ? name.split(' ')[0] : firstName || '',
      lastName: name ? name.split(' ').slice(1).join(' ') : lastName || '',
      imageUrl: imageUrl || '',
      role: 'MEMBER',
      isActive: true,
      permissions: ['read:books'],
      subscriptionStatus: 'TRIAL',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!newUser?.id) {
    throw new Error('Failed to create user');
  }

  return { 
    user: newUser, 
    isNew: true,
    userId: newUser.id,
    success: true
  };
}
