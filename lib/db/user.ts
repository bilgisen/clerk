import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

type CreateUserInput = {
  email: string;
  passwordHash: string;
  salt: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
};

export async function createUser({
  email,
  passwordHash,
  salt,
  firstName = "",
  lastName = "",
  imageUrl = "",
}: CreateUserInput) {
  // Check if user with email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Create a new user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      salt,
      firstName,
      lastName,
      imageUrl,
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
