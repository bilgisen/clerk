import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? '';
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? '';
  const svix_signature = headerPayload.get("svix-signature") ?? '';

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  let evt: WebhookEvent;

  // Verify the webhook signature
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;
        const email = email_addresses?.[0]?.email_address;

        if (!email) {
          console.error('No email found in webhook data');
          return new Response('No email provided', { status: 400 });
        }

        // Check if user already exists
        if (!id || typeof id !== 'string') {
          throw new Error('Valid user ID is required');
        }
        
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, id as string))
          .limit(1);

        const userData = {
          clerkId: id,
          email,
          firstName: first_name || '',
          lastName: last_name || '',
          imageUrl: image_url || '',
          updatedAt: new Date(),
        };

        if (existingUser.length > 0) {
          // Update existing user
          await db
            .update(users)
            .set(userData)
            .where(eq(users.clerkId, id));
        } else {
          // Create new user
          await db.insert(users).values({
            ...userData,
            createdAt: new Date(),
            role: 'MEMBER',
            isActive: true,
            permissions: ['read:books'],
            subscriptionStatus: 'TRIAL',
            monthlyBookQuota: 1,
            booksCreatedThisMonth: 0,
            totalBooksCreated: 0,
            metadata: {},
          });
        }
        break;
      }
      case 'user.deleted': {
        const { id } = evt.data;
        if (!id || typeof id !== 'string') {
          throw new Error('Valid user ID is required for deletion');
        }
        // Soft delete the user by setting is_active to false
        await db
          .update(users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(users.clerkId, id as string));
        break;
      }
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response('', { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}
