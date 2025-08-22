"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditsWidget } from "@/components/credits/credits-widget";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Welcome Card */}
        <div className="md:col-span-2">
          <div className="bg-card rounded-lg p-6 shadow-sm border">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Your Dashboard</h1>
            <p className="text-muted-foreground mb-6">
              Get started by adding your first book to your collection or explore your existing books.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => router.push('/dashboard/books/new')}
                className="min-w-[180px]"
              >
                Add New Book
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard/books')}
                className="min-w-[180px]"
              >
                View All Books
              </Button>
            </div>
          </div>
        </div>
        
        {/* Credits Widget */}
        <div className="md:col-span-1">
          <CreditsWidget />
        </div>
      </div>
    </div>
  );
}
