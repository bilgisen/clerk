import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHmac } from "crypto";
import { creditService } from "@/lib/services/credits/credit-service";

// Force Node.js runtime for transactions
export const runtime = "nodejs";

// Helper to verify Polar webhook signature
function verifyPolarSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(body).digest("hex");
  return signature === digest;
}

// Map Polar plan IDs to credit amounts
function getCreditsForPlan(priceId: string): number {
  const planCredits: Record<string, number> = {
    // Example plans - update these with your actual Polar price IDs
    "price_basic_monthly": 100,
    "price_pro_monthly": 300,
    "price_basic_yearly": 1200,
    "price_pro_yearly": 3600,
  };

  return planCredits[priceId] || 0;
}

export async function POST(req: Request) {
  try {
    // Verify webhook signature
    const signature = headers().get("x-polar-signature");
    if (!signature) {
      return new NextResponse("Missing signature", { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET is not set");
      return new NextResponse("Server error", { status: 500 });
    }

    const isValid = verifyPolarSignature(body, signature, webhookSecret);
    if (!isValid) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);
    console.log("Polar webhook received:", event.type);

    // Handle different event types
    switch (event.type) {
      // Handle subscription events
      case "subscription.created":
      case "subscription.updated": {
        const { data } = event;
        const userId = data.metadata?.clerkUserId;
        
        if (!userId) {
          console.warn("No clerkUserId in subscription metadata");
          return new NextResponse("Missing user ID", { status: 400 });
        }

        // Only process active subscriptions
        if (data.status === "active" && data.current_period_start) {
          const credits = getCreditsForPlan(data.price_id);
          
          if (credits > 0) {
            await creditService.addCredits({
              userId,
              amount: credits,
              reason: "subscription_credit",
              ref: data.id,
              idempotencyKey: `polar:sub:${data.id}:${data.current_period_start}`,
              source: "polar",
              metadata: {
                subscriptionId: data.id,
                priceId: data.price_id,
                billingPeriod: data.interval,
                eventId: event.id,
              },
            });
          }
        }
        break;
      }

      // Handle one-time purchases
      case "order.paid":
      case "order.completed": {
        const { data } = event;
        const userId = data.metadata?.clerkUserId;
        const creditBundle = data.metadata?.creditBundle;
        
        if (!userId || !creditBundle) {
          console.warn("Missing userId or creditBundle in order metadata", {
            userId,
            creditBundle,
          });
          return new NextResponse("Missing required data", { status: 400 });
        }

        const credits = parseInt(creditBundle, 10);
        if (isNaN(credits) || credits <= 0) {
          console.warn("Invalid credit bundle value:", creditBundle);
          return new NextResponse("Invalid credit bundle", { status: 400 });
        }

        await creditService.addCredits({
          userId,
          amount: credits,
          reason: "purchase",
          ref: data.id,
          idempotencyKey: `polar:order:${data.id}`,
          source: "polar",
          metadata: {
            orderId: data.id,
            amount: data.amount,
            currency: data.currency,
            eventId: event.id,
          },
        });
        break;
      }

      // Handle subscription cancellation
      case "subscription.canceled":
      case "subscription.paused": {
        // Optionally handle subscription cancellation or pausing
        console.log("Subscription status changed:", event.type, event.data.id);
        break;
      }

      default:
        console.log("Unhandled Polar event type:", event.type);
    }

    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error processing Polar webhook:", error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}
