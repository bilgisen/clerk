"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingPortalButton } from "@/components/billing/billing-portal-button";
import { useCredits } from "@/hooks/use-credits";
import { format } from "date-fns";
import { Loader2, Zap, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BillingPage() {
  const { user, isLoading } = useAuth();
  const { balance, isLoading: creditsLoading, error } = useCredits();
  
  // In a real app, you would fetch this from your API
  const subscription = {
    status: 'active', // 'active', 'canceled', 'past_due', etc.
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    plan: 'Pro',
    isTrial: false,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load billing information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
          <p className="text-muted-foreground">
            Manage your subscription and payment methods
          </p>
        </div>
        <BillingPortalButton className="mt-4 md:mt-0" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Your current subscription plan and billing cycle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-2xl font-bold">{subscription.plan}</p>
              </div>
              <div className="rounded-md bg-primary/10 px-3 py-1 text-sm text-primary">
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span>
                  {subscription.status === 'active' ? 'Next billing date: ' : 'Ends on: '}
                  {format(subscription.currentPeriodEnd, 'MMMM d, yyyy')}
                </span>
              </div>
              {subscription.isTrial && (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  Your trial ends on {format(subscription.currentPeriodEnd, 'MMMM d, yyyy')}
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button variant="outline" className="w-full" asChild>
                <a href="/pricing">Change Plan</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>
              Update your payment information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="h-6 w-6 mr-2 text-muted-foreground" />
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/25</p>
                </div>
              </div>
              <BillingPortalButton variant="ghost" size="sm">
                Update
              </BillingPortalButton>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Billing Email</h4>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  user@example.com
                </p>
                <Button variant="ghost" size="sm">
                  Update
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Balance</CardTitle>
          <CardDescription>
            Your current credit balance and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Credits</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{balance?.toLocaleString()}</span>
                <span className="text-muted-foreground">credits</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {subscription.plan} Plan
              </p>
              <Button variant="link" className="p-0 h-auto" asChild>
                <a href="/pricing">Upgrade for more credits</a>
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2">Usage this month</h4>
            <div className="relative pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary-600 bg-primary-50">
                    {Math.round((balance / 1000) * 100)}% used
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-primary-600">
                    {balance} / 1000
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-muted mt-2">
                <div
                  style={{ width: `${Math.min(100, (balance / 1000) * 100)}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                View and download your past invoices
              </CardDescription>
            </div>
            <BillingPortalButton variant="outline" size="sm">
              View all invoices
            </BillingPortalButton>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Pro Plan - Monthly</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(Date.now() - item * 30 * 24 * 60 * 60 * 1000), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${29}.00</p>
                  <p className="text-sm text-muted-foreground">
                    {item === 1 ? 'Next billing' : 'Paid'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
