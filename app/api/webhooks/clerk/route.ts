import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      case "user.created":
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
          await db.insert(users).values({
            ...userData,
            role: "MEMBER",
            isActive: true,
            permissions: ["read:books"],
            subscriptionStatus: "TRIAL",
            credits: 20,
            metadata: {},
            createdAt: new Date(),
          });
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
