"use client";

import { Button } from "@/components/ui/button";
import { usePolar } from "@/hooks/use-polar";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface BillingPortalButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive" | null | undefined;
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
  className?: string;
  children?: React.ReactNode;
}

export function BillingPortalButton({
  variant = "outline",
  size = "default",
  className = "",
  children = "Billing & Subscription",
}: BillingPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { redirectToCustomerPortal } = usePolar();

  const handleClick = async () => {
    try {
      setIsLoading(true);
      await redirectToCustomerPortal();
    } catch (error) {
      console.error("Error redirecting to billing portal:", error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
