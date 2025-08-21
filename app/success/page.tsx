import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId } = auth();
  
  // If user is not authenticated, redirect to sign-in
  if (!userId) {
    redirect("/sign-in?redirect_url=/success");
  }

  // Get the checkout ID from the URL
  const checkoutId = searchParams.checkout_id || searchParams.checkoutId;
  
  // If no checkout ID is provided, show a generic success message
  if (!checkoutId) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Success!</CardTitle>
            <CardDescription>
              Your purchase was successful. Thank you for your order!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Your credits have been added to your account.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Here you would typically verify the checkout with Polar API
  // and update the user's account accordingly
  try {
    // This is where you would verify the checkout with Polar
    // const response = await verifyPolarCheckout(checkoutId.toString(), userId);
    
    // For now, we'll just show a success message
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Payment Successful!</CardTitle>
            <CardDescription>
              Thank you for your purchase. Your subscription is now active.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your credits have been added to your account and are ready to use.
            </p>
            <div className="bg-muted p-4 rounded-md text-sm text-left">
              <p className="font-medium">Order Details:</p>
              <p>Order ID: {checkoutId}</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Button asChild variant="outline">
              <Link href="/pricing">View Plans</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("Error processing checkout:", error);
    // Redirect to error page or show error message
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Error Processing Your Order</CardTitle>
            <CardDescription>
              We encountered an issue while processing your payment.
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
}
