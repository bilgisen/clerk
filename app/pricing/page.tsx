"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Loader2 } from "lucide-react";
import { usePolar } from "@/hooks/use-polar";
import { useState } from "react";
import toast from "sonner";

type Plan = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceId: string;
  features: string[];
  popular?: boolean;
  credits: number;
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for getting started",
    price: "$9",
    priceId: process.env.NEXT_PUBLIC_POLAR_PRICE_STARTER || "price_123",
    credits: 100,
    features: [
      "100 credits per month",
      "Basic support",
      "Email assistance"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    description: "For professionals who need more",
    price: "$29",
    priceId: process.env.NEXT_PUBLIC_POLAR_PRICE_PRO || "price_456",
    credits: 500,
    popular: true,
    features: [
      "500 credits per month",
      "Priority support",
      "Email & chat support",
      "Advanced analytics"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For businesses with custom needs",
    price: "Custom",
    priceId: "",
    credits: 0,
    features: [
      "Unlimited credits",
      "24/7 priority support",
      "Dedicated account manager",
      "Custom integrations",
      "SLA & uptime guarantees"
    ]
  }
];

export default function PricingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { redirectToCheckout, isLoading } = usePolar();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: Plan) => {
    if (authLoading) return;
    
    if (!user) {
      router.push(`/signin?redirect=/pricing`);
      return;
    }

    if (!plan.priceId) {
      // Handle enterprise plan (no price ID)
      router.push("/contact");
      return;
    }

    try {
      setSelectedPlan(plan.id);
      await redirectToCheckout({
        priceId: plan.priceId,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          credits: plan.credits,
          userId: user.id
        },
        successUrl: `${window.location.origin}/success?plan=${encodeURIComponent(plan.name)}`,
      });
    } catch (error) {
      console.error("Error redirecting to checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setSelectedPlan(null);
    }
  };

  return (
    <div className="container py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that works best for you. Upgrade, downgrade, or cancel anytime.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={cn(
              "relative overflow-hidden",
              plan.popular ? "border-2 border-primary" : ""
            )}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-md">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== "Custom" && <span className="text-muted-foreground">/month</span>}
              </div>
              {plan.credits > 0 && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <Zap className="h-4 w-4 mr-1 text-amber-500" />
                  {plan.credits.toLocaleString()} credits included
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                size="lg"
                disabled={isLoading && selectedPlan === plan.id}
                onClick={() => handleSelectPlan(plan)}
              >
                {isLoading && selectedPlan === plan.id ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : plan.price === "Custom" ? (
                  "Contact Sales"
                ) : (
                  "Get Started"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>Need more? We offer custom plans for high-volume users and enterprises.</p>
        <Button variant="link" className="mt-2">
          Contact our sales team
        </Button>
      </div>
    </div>
  );
}

// Helper function to conditionally apply classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
