// app/dashboard/activity/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from 'date-fns/locale';
import { Activity, CreditCard, Loader2 } from "lucide-react";

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  delta: number;
  ref: string | null;
  createdAt: string;
};

type CreditSummary = {
  success: boolean;
  data: {
    balance: number;
    recentActivities: ActivityItem[];
  };
};

export default function ActivityPage() {
  const { getToken } = useAuth();

  const { data, isLoading, error } = useQuery<CreditSummary>({
    queryKey: ['credits-summary'],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/credits/summary', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }
      return response.json();
    },
  });

  const formatActivityTitle = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'signup_bonus':
        return 'Welcome Bonus';
      case 'book_create':
        return 'Book Creation';
      case 'book_deletion_refund':
        return 'Book Deletion Refund';
      default:
        return activity.title;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Activities</h1>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Hareketler yüklenirken bir hata oluştu</h3>
          <p className="text-sm text-muted-foreground mt-2">Lütfen daha sonra tekrar deneyiniz.</p>
        </div>
      </div>
    );
  }

  const activities = data?.data?.recentActivities || [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Activities</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Total Credits: <span className="font-semibold">{data?.data?.balance || 0} Credits</span>
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Credit Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No activities found</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your credit usage will be displayed here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      activity.delta > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {activity.delta > 0 ? (
                        <span className="font-medium">+{activity.delta}</span>
                      ) : (
                        <span className="font-medium">{activity.delta}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{formatActivityTitle(activity)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: tr })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
