import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { creditService } from "@/lib/services/credits/credit-service";
import { z } from "zod";

// Force Node.js runtime for transactions
export const runtime = "nodejs";

// Define the request schema
const consumeRequestSchema = z.object({
  action: z.enum(["book.create", "publish.epub", "publish.pdf", "publish.audio"]),
  ref: z.string().optional(),
  words: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

// Define credit costs
const CREDIT_COSTS = {
  "book.create": 10,
  "publish.epub": 5,
  "publish.pdf": 5,
  "publish.audio": 1, // per 1000 words
} as const;

// Calculate the cost based on action and optional word count
function calculateCost(action: string, words?: number): number {
  const baseCost = CREDIT_COSTS[action as keyof typeof CREDIT_COSTS] || 0;
  
  if (action === "publish.audio" && words !== undefined) {
    // Round up to nearest 1000 words for audio
    const wordChunks = Math.ceil(words / 1000);
    return baseCost * wordChunks;
  }
  
  return baseCost;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse and validate the request body
    const body = await req.json();
    const validation = consumeRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: "Invalid request",
          details: validation.error.format() 
        }), 
        { status: 400 }
      );
    }

    const { action, ref, words, idempotencyKey } = validation.data;
    
    // Calculate the cost
    const amount = calculateCost(action, words);
    
    if (amount <= 0) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: "Invalid action or word count" 
        }), 
        { status: 400 }
      );
    }

    // Try to spend the credits
    try {
      const result = await creditService.spendCredits({
        userId,
        amount,
        reason: action,
        ref,
        idempotencyKey: `consume:${idempotencyKey}`,
        metadata: words ? { words } : {},
      });

      return NextResponse.json({
        success: true,
        data: {
          amountSpent: amount,
          newBalance: result.balance,
          action,
          ref,
        },
      });
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_CREDITS") {
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            required: amount,
          }), 
          { status: 402 } // Payment Required
        );
      }
      
      console.error("Error spending credits:", error);
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: "Failed to process credit transaction" 
        }), 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in consume endpoint:", error);
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error" 
      }), 
      { status: 500 }
    );
  }
}
