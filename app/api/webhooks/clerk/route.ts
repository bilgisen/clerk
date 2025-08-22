import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import type { UserJSON } from "@clerk/types";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { creditService } from "@/lib/services/credits/credit-service";
import { v4 as uuidv4 } from "uuid";

// Helper function to log webhook events for debugging
const logWebhook = (eventType: string, data: any, message: string, level: 'info' | 'error' = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${eventType}] ${message}\nData: ${JSON.stringify(data, null, 2)}`;
  
  if (level === 'error') {
    console.error(logMessage);
  } else {
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
        const { id, email_addresses, first_name, last_name, image_url, primary_email_address_id } = data;
        
        // Find the primary email address
        const primaryEmail = email_addresses?.find((email: any) => email.id === primary_email_address_id)?.email_address;
        const email = primaryEmail || email_addresses?.[0]?.email_address;
        
        logWebhook(currentEventType, { clerkUserId: id, email }, 'Processing user.created event');

        if (!id || typeof id !== "string") {
          throw new Error("Valid Clerk user ID is required");
        }

        // Create or update user within a transaction
        await db.transaction(async (tx: typeof db) => {
          const userData = {
            clerkId: id,
            email,
            firstName: first_name || "",
            lastName: last_name || "",
            imageUrl: image_url || "",
            updatedAt: new Date(),
          };

          // Check if user exists
          const existingUser = await tx
            .select()
            .from(users)
            .where(and(
              eq(users.clerkId, id),
              eq(users.isActive, true)
            ))
            .limit(1);

          let userId: string;
          
          if (existingUser.length > 0) {
            await tx.update(users)
              .set(userData)
              .where(eq(users.clerkId, id));
            userId = existingUser[0].id;
            logWebhook(currentEventType, { userId, clerkId: id }, 'Updated existing user');
          } else {
            const [newUser] = await tx.insert(users).values({
              ...userData,
              role: "MEMBER",
              isActive: true,
              permissions: ["read:books"],
              subscriptionStatus: "TRIAL",
              metadata: {},
              createdAt: new Date(),
            }).returning();
            
            if (!newUser || !newUser.id) {
              throw new Error('Failed to create new user');
            }
            
            userId = newUser.id;
            logWebhook(currentEventType, { userId, clerkId: id }, 'Created new user');
          
            // Award signup bonus for new users
            try {
              const webhookId = svix_id || `clerk-${uuidv4()}`;
              const idempotencyKey = `clerk:signup:${id}:${webhookId}`;
              
              logWebhook(currentEventType, { userId, idempotencyKey }, 'Awarding signup bonus');
              
              try {
                const result = await creditService.addCredits({
                  userId,
                  amount: 1000, // Increased from 100 to 1000 for better testing
                  reason: "signup_bonus",
                  idempotencyKey,
                  metadata: {
                    clerkEventId: webhookId,
                    clerkUserId: id,
                    eventType: "user.created",
                    source: "clerk_webhook"
                  }
                });
                
                logWebhook(currentEventType, { 
                  userId, 
                  idempotencyKey, 
                  result 
                }, 'Successfully added credits');
              } catch (error) {
                logWebhook(currentEventType, { 
                  userId, 
                  idempotencyKey, 
                  error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                  } : String(error)
                }, 'Error adding credits', 'error');
                throw error; // Re-throw to trigger the outer catch
              }
              
              logWebhook(currentEventType, { userId, idempotencyKey }, 'Successfully awarded signup bonus');
            } catch (error) {
              logWebhook(currentEventType, { 
                userId, 
                error: error instanceof Error ? error.message : String(error) 
              }, 'Failed to award signup bonus', 'error');
              // Don't fail the transaction if bonus fails
            }
          }
          
          // Transaction will automatically commit if no errors are thrown
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'User processed successfully',
          userId: id
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
