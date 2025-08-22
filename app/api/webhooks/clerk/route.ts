import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import type { UserJSON } from "@clerk/types";
import { db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { creditService } from "@/lib/services/credits/credit-service";
import { v4 as uuidv4 } from "uuid";
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Helper function to log webhook events for debugging
const logWebhook = (eventType: string, data: any, message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${eventType}] ${message}\nData: ${JSON.stringify(data, null, 2)}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'info':
    default:
      console.log(logMessage);
  }
};

export async function POST(req: Request) {
  // Clerk webhook header’larını al
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const currentEventType = evt.type;
  
  try {
    logWebhook(currentEventType, { ...evt.data, eventId: svix_id }, 'Processing webhook event');
    
    switch (currentEventType) {
      case "user.created": {
        const data: any = evt.data;
        const { 
          id: clerkUserId, 
          email_addresses = [], 
          first_name, 
          last_name, 
          image_url,
          primary_email_address_id 
        } = data;
        
        // Handle email address (might be empty in some cases like test events)
        let email: string | null = null;
        
        if (Array.isArray(email_addresses) && email_addresses.length > 0) {
          // Try to find the primary email, fallback to first email
          email = email_addresses.find((e: any) => e.id === primary_email_address_id)?.email_address || 
                  email_addresses[0]?.email_address || null;
        }
        
        // If no email found, generate a fallback email using clerk user ID
        if (!email) {
          email = `${clerkUserId}@no-email.local`;
          logWebhook(currentEventType, { clerkUserId }, 'No email provided, using fallback', 'warn');
        }
        
        logWebhook(currentEventType, { clerkUserId, email }, 'Processing user.created event');

        if (!clerkUserId || typeof clerkUserId !== "string") {
          throw new Error("Valid Clerk user ID is required");
        }

        // First check if user already exists using direct query
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkUserId))
          .limit(1)
          .then((rows: User[]) => rows[0] || null);

        if (existingUser) {
          logWebhook(currentEventType, { clerkUserId }, 'User already exists, skipping creation');
          return { 
            success: true, 
            message: 'User already exists',
            userId: existingUser.id,
            isNew: false 
          };
        }

        // Create new user
        const newUserData: NewUser = {
          clerkId: clerkUserId,
          email,
          firstName: first_name || "",
          lastName: last_name || "",
          imageUrl: image_url || "",
          role: 'MEMBER',
          isActive: true,
          permissions: ['read:books'],
          subscriptionStatus: 'TRIAL',
          credits: 0, // Will be set via credit ledger
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const [newUser] = await db.insert(users)
          .values(newUserData)
          .returning({ id: users.id });

        if (!newUser?.id) {
          throw new Error('Failed to create user');
        }

        const userId = newUser.id;
        logWebhook(currentEventType, { userId, clerkUserId }, 'Created new user');
        const result = { userId, isNew: true };

        // Award signup bonus if this is a new user
        if (result.isNew) {
          const webhookId = svix_id || `clerk-${uuidv4()}`;
          const idempotencyKey = `signup-bonus-${result.userId}-${webhookId}`;
          
          try {
            logWebhook(currentEventType, { 
              userId: result.userId, 
              idempotencyKey 
            }, 'Awarding signup bonus');
            
            // Use the credit service to add credits
            const creditResult = await creditService.addCredits({
              userId: result.userId,
              amount: 1000, // Signup bonus amount
              reason: 'signup_bonus',
              idempotencyKey,
              metadata: {
                clerkEventId: webhookId,
                clerkUserId,
                eventType: 'user.created',
                source: 'clerk_webhook_signup'
              }
            });
            
            logWebhook(currentEventType, { 
              userId: result.userId,
              creditResult
            }, 'Successfully awarded signup bonus');
            
          } catch (error) {
            logWebhook(currentEventType, { 
              userId: result.userId,
              error: error instanceof Error ? error.message : String(error)
            }, 'Failed to award signup bonus', 'error');
            // Don't fail the transaction if bonus fails
          }
        }
        
        // If we get here, return success response
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'User processed successfully',
          userId: result.userId,
          clerkUserId,
          isNew: result.isNew
        }), { 
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      case "user.updated": {
        const data: any = evt.data;
        const { id, email_addresses, first_name, last_name, image_url } = data;
        const email = email_addresses?.[0]?.email_address;

        if (!id || typeof id !== "string") {
          throw new Error("Valid Clerk user ID is required");
        }
        if (!email) {
          throw new Error("Email is required");
        }

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, id))
          .limit(1);

        const userData = {
          clerkId: id,
          email,
          firstName: first_name || "",
          lastName: last_name || "",
          imageUrl: image_url || "",
          updatedAt: new Date(),
        };

        if (existingUser.length > 0) {
          await db.update(users).set(userData).where(eq(users.clerkId, id));
        } else {
          // Create the user
          const [newUser] = await db.insert(users).values({
            ...userData,
            role: "MEMBER",
            isActive: true,
            permissions: ["read:books"],
            subscriptionStatus: "TRIAL",
            metadata: {},
            createdAt: new Date(),
          }).returning();

          // Award signup bonus for new users
          if (newUser) {
            try {
              const webhookHeaders = await headers();
              const webhookId = webhookHeaders.get("svix-id") || `clerk-${uuidv4()}`;
              
              await creditService.addCredits({
                userId: newUser.id,
                amount: 100,
                reason: "signup_bonus",
                idempotencyKey: `clerk:signup:${id}:${webhookId}`,
                source: "clerk",
                metadata: {
                  clerkEventId: webhookId,
                  clerkUserId: id,
                  eventType: "user.updated"
                }
              });
              
              console.log(`Successfully awarded signup bonus to user ${newUser.id}`);
            } catch (error) {
              console.error("Failed to award signup bonus:", error);
              // Don't fail the entire request, just log the error
            }
          }
        }
        break;
      }

      case "user.deleted": {
        const data: any = evt.data;
        const { id } = data;
        if (!id || typeof id !== "string") {
          throw new Error("Valid Clerk user ID is required for deletion");
        }

        await db
          .update(users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(users.clerkId, id));
        break;
      }

      default:
        console.log(`Unhandled event type: ${currentEventType}`);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logWebhook(currentEventType || 'unknown', { error: error.message, stack: error.stack }, 'Error processing webhook', 'error');
    return new Response(`Error processing webhook: ${error.message}`, { status: 500 });
  }
}
