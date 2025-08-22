// app/api/webhooks/clerk/route.ts
export const runtime = 'nodejs';

import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { createOrGetUser } from "@/lib/db/user";
import { creditService } from "@/lib/services/credits/credit-service";

const logWebhook = (
  eventType: string,
  data: Record<string, any>,
  message: string,
  level: 'info' | 'error' | 'warn' = 'info'
) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${eventType}] ${message}\nData: ${JSON.stringify(data)}`;
  
  if (level === 'error') console.error(logMessage);
  else if (level === 'warn') console.warn(logMessage);
  else console.log(logMessage);
};

export async function POST(req: Request) {
  const svix_id = req.headers.get('svix-id') ?? '';
  const svix_timestamp = req.headers.get('svix-timestamp') ?? '';
  const svix_signature = req.headers.get('svix-signature') ?? '';

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return Response.json(
      { success: false, message: 'Missing Svix headers' },
      { status: 400 }
    );
  }

  const body = await req.text(); // <-- önemli: verify için raw body lazım
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logWebhook('webhook_verification', { error }, 'Error verifying webhook', 'error');
    return Response.json({ success: false, message: 'Invalid signature', error }, { status: 400 });
  }

  const currentEventType = evt.type;

  try {
    switch (currentEventType) {
      case 'user.created': {
        const data = evt.data as any;
        const { 
          id: clerkUserId, 
          email_addresses = [], 
          first_name, 
          last_name, 
          image_url, 
          primary_email_address_id 
        } = data;

        // Extract primary email or fallback to first available
        let email: string | null = null;
        if (Array.isArray(email_addresses) && email_addresses.length > 0) {
          email =
            email_addresses.find((e: any) => e.id === primary_email_address_id)?.email_address ||
            email_addresses[0]?.email_address ||
            null;
        }

        logWebhook(currentEventType, { clerkUserId, email }, 'Processing user creation');

        if (!clerkUserId || typeof clerkUserId !== 'string') {
          throw new Error('Valid Clerk user ID is required');
        }

        // Create or get the user
        const result = await createOrGetUser({
          clerkId: clerkUserId,
          email: email || `${clerkUserId}@no-email.local`,
          name: first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name,
          firstName: first_name,
          lastName: last_name,
          imageUrl: image_url,
        });

        // Only award signup bonus for new users
        if (result.isNew) {
          try {
            await creditService.awardSignupBonus(result.userId);
            logWebhook(
              currentEventType,
              { userId: result.userId, clerkUserId },
              'Awarded signup bonus to new user'
            );
          } catch (error) {
            logWebhook(
              currentEventType,
              { userId: result.userId, clerkUserId, error: error instanceof Error ? error.message : 'Unknown error' },
              'Failed to award signup bonus',
              'error'
            );
          }
        }

        logWebhook(
          currentEventType,
          { userId: result.userId, clerkUserId, isNew: result.isNew },
          result.isNew ? 'Created new user' : 'User already exists'
        );

        return Response.json({
          success: true,
          message: 'User processed successfully',
          userId: result.userId,
          clerkUserId,
          isNew: result.isNew,
        });
      }

      default:
        logWebhook(currentEventType, { eventId: svix_id }, 'Unhandled event type', 'warn');
        return Response.json({ success: true, message: 'Event type not handled', eventType: currentEventType });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logWebhook(currentEventType || 'unknown', { error: errorMessage }, 'Error processing webhook', 'error');

    return Response.json({ success: false, message: 'Error processing webhook', error: errorMessage }, { status: 500 });
  }
}
