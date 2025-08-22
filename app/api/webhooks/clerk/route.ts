import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import type { UserJSON } from "@clerk/types";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { creditService } from "@/lib/services/credits/credit-service";
import { v4 as uuidv4 } from "uuid";

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

  const eventType = evt.type;

  try {
    switch (eventType) {
      case "user.created": {
        const data: any = evt.data;
        const { id, email_addresses, first_name, last_name, image_url } = data;
        const email = email_addresses?.[0]?.email_address;

        if (!id || typeof id !== "string") {
          throw new Error("Valid Clerk user ID is required");
        }

        // Signup bonus is now handled in the user creation flow

        // Create or update user
        const userData = {
          clerkId: id,
          email,
          firstName: first_name || "",
          lastName: last_name || "",
          imageUrl: image_url || "",
          updatedAt: new Date(),
        };

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, id))
          .limit(1);

        if (existingUser.length > 0) {
          await db.update(users).set(userData).where(eq(users.clerkId, id));
        } else {
          const newUser = await db.insert(users).values({
            ...userData,
            role: "MEMBER",
            isActive: true,
            permissions: ["read:books"],
            subscriptionStatus: "TRIAL",
            metadata: {},
            createdAt: new Date(),
          }).returning();
          
          // Award signup bonus for new users
          try {
            // Get the webhook event ID from the headers
            const webhookHeaders = await headers();
            const webhookId = webhookHeaders.get("svix-id") || `clerk-${uuidv4()}`;
            
            // Add initial credits
            await creditService.addCredits({
              userId: newUser[0].id,
              amount: 100,
              reason: "signup_bonus",
              idempotencyKey: `clerk:signup:${id}:${webhookId}`,
              source: "clerk",
              metadata: {
                clerkEventId: webhookId,
                clerkUserId: id,
                eventType: "user.created"
              }
            });
          } catch (error) {
            console.error('Failed to award signup bonus:', error);
            // Don't fail the webhook if bonus fails
          }
        }
        break;
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
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (err) {
    console.error("Error handling webhook:", err);
    return new Response("Error processing webhook", { status: 500 });
  }
}
