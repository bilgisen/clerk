import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { createOrGetUser } from '@/lib/actions/user-actions';

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
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id') ?? '';
  const svix_timestamp = headerPayload.get('svix-timestamp') ?? '';
  const svix_signature = headerPayload.get('svix-signature') ?? '';

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Missing Svix headers'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

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
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid signature',
      error
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const currentEventType = evt.type;
  
  try {
    logWebhook(currentEventType, { eventId: svix_id }, 'Processing webhook event');
    
    if (currentEventType !== 'user.created') {
      logWebhook(currentEventType, {}, 'Unhandled event type', 'warn');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Event type not handled',
        eventType: currentEventType
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle user.created event
    const data = evt.data as any;
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

    if (!clerkUserId || typeof clerkUserId !== 'string') {
      throw new Error('Valid Clerk user ID is required');
    }

    // Create or get user using server action
    const result = await createOrGetUser({
      clerkUserId,
      email,
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url
    });

    logWebhook(
      currentEventType, 
      { userId: result.userId, clerkUserId, isNew: result.isNew }, 
      result.isNew ? 'Created new user' : 'User already exists'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User processed successfully',
      userId: result.userId,
      clerkUserId,
      isNew: result.isNew
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logWebhook(currentEventType || 'unknown', { error: errorMessage }, 'Error processing webhook', 'error');
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error processing webhook',
      error: errorMessage
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
