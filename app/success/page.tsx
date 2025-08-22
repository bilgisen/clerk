'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { verifyAndUpdateCredits } from './actions';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  useEffect(() => {
    const processCheckout = async () => {
      const checkoutId = searchParams.get('checkout_id') || searchParams.get('checkoutId');
      setCheckoutId(checkoutId);

      if (!checkoutId) {
        setStatus('success');
        return;
      }

      try {
        const result = await verifyAndUpdateCredits(checkoutId);
        if (result.success) {
          setStatus('success');
        } else {
          setError(result.error || 'An unknown error occurred');
          setStatus('error');
        }
      } catch (err) {
        console.error('Error processing checkout:', err);
        setError('Failed to process your payment. Please try again or contact support.');
        setStatus('error');
      }
    };

    processCheckout();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <CardTitle>Processing Your Order</CardTitle>
            <CardDescription>
              Please wait while we verify your payment...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Error Processing Your Order</CardTitle>
            <CardDescription>
              {error || 'We encountered an issue while processing your payment.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Please contact support if the issue persists.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Button asChild variant="outline">
              <Link href="/pricing">Try Again</Link>
            </Button>
            <Button asChild>
              <Link href="/support">Contact Support</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="container max-w-2xl py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle>Payment Successful!</CardTitle>
          <CardDescription>
            {checkoutId 
              ? 'Thank you for your purchase. Your subscription is now active.'
              : 'Your purchase was successful. Thank you for your order!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {checkoutId 
              ? 'Your credits have been added to your account and are ready to use.'
              : 'Your credits have been added to your account.'}
          </p>
          {checkoutId && (
            <div className="bg-muted p-4 rounded-md text-sm text-left">
              <p className="font-medium">Order Details:</p>
              <p>Order ID: {checkoutId}</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          {checkoutId && (
            <Button asChild variant="outline">
              <Link href="/pricing">View Plans</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
