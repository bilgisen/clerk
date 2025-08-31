// components/credits/credits-widget.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

// Types for the API response
type CreditSummary = {
  success: boolean;
  data: {
    balance: number;
    recentActivities: Array<{
      id: string;
      type: string;
      title: string;
      delta: number;
      ref: string | null;
      createdAt: string;
    }>;
  };
};

// Format number with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

// Format activity title
const formatActivityTitle = (activity: any) => {
  if (activity.title) return activity.title;
  
  switch (activity.type) {
    case 'signup_bonus':
      return 'Sign up bonus';
    case 'book_create':
      return 'Created a book';
    case 'publish_epub':
      return 'Published EPUB';
    case 'publish_pdf':
      return 'Published PDF';
    case 'publish_audio':
      return 'Published Audio Book';
    case 'subscription':
      return 'Subscription credit';
    case 'purchase':
      return 'Purchased credits';
    default:
      return 'Credit activity';
  }
};

export function CreditsWidget() {
  const { getToken } = useAuth();
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery<CreditSummary>({
    queryKey: ['credits-summary'],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/credits/summary', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Monthly target (can be customized based on user's plan)
  const monthlyTarget = 1000;
  const balance = data?.data?.balance ?? 0;
  
  // Calculate monthly usage (spent this month)
  const monthlyUsage = monthlyTarget - Math.max(0, balance);
  const usagePercentage = Math.min(100, Math.round((monthlyUsage / monthlyTarget) * 100));
  const recentActivities = data?.data?.recentActivities ?? [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Your Credits
            </CardTitle>
            <CardDescription>
              Manage your credit balance and activity
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="ml-auto"
            disabled={isLoading || isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
            {isLoading || isRefetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-6">
        {/* Balance Card */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <h3 className="text-3xl font-bold">
                {isLoading ? '...' : formatNumber(balance)}
                <span className="text-sm font-normal text-muted-foreground ml-1">credits</span>
              </h3>
            </div>
            <Link href="/pricing">
              <Button size="sm" variant="outline">
                Buy More
              </Button>
            </Link>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Monthly Usage</span>
              <span>{usagePercentage}%</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <div className="text-sm font-medium text-muted-foreground">
              {formatNumber(monthlyUsage)} of {formatNumber(monthlyTarget)} credits used
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="flex-1 flex flex-col">
          <h4 className="font-medium mb-3">Recent Activity</h4>
          
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-destructive">
              Failed to load activity
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No recent activity
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {formatActivityTitle(activity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={cn(
                    "font-mono font-medium ml-4 whitespace-nowrap",
                    activity.delta > 0 ? "text-green-600" : "text-foreground"
                  )}>
                    {activity.delta > 0 ? '+' : ''}{activity.delta}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {recentActivities.length > 0 && (
            <div className="mt-4 text-center">
              <Link href="/dashboard/activity" passHref>
                <Button variant="ghost" size="sm" asChild>
                  <span>View All Activities</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
