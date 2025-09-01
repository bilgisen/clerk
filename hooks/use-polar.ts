import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { polarService } from "@/lib/services/polar/polar-service";

type CheckoutParams = {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
};

export function usePolar() {
  const { user } = useAuth() as { user: { id: string; email: string } | null };
  const userId = user?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const redirectToCheckout = useCallback(
    async (params: CheckoutParams) => {
      if (!userId) {
        throw new Error("User must be authenticated");
      }

      setIsLoading(true);
      setError(null);

      try {
        const { url } = await polarService.createCheckoutSession({
          priceId: params.priceId,
          successUrl: params.successUrl || `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: params.cancelUrl || window.location.href,
          customerEmail: user?.email || '',
          metadata: {
            userId: userId,
            ...params.metadata,
          },
        });

        // Redirect to Polar checkout
        window.location.href = url;
      } catch (err) {
        console.error("Error redirecting to checkout:", err);
        setError(err instanceof Error ? err : new Error("Failed to redirect to checkout"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, user?.email, setError, setIsLoading]
  );

  const redirectToCustomerPortal = useCallback(async (returnUrl: string = window.location.href) => {
    if (!userId) {
      throw new Error("User must be authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the customer ID from your database
      const customerId = userId;
      
      const { url } = await polarService.createPortalSession(customerId, returnUrl);
      
      // Redirect to customer portal
      window.location.href = url;
    } catch (err) {
      console.error("Error redirecting to customer portal:", err);
      setError(err instanceof Error ? err : new Error("Failed to redirect to customer portal"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, setError, setIsLoading]);

  return {
    redirectToCheckout,
    redirectToCustomerPortal,
    isLoading,
    error,
  };
}
