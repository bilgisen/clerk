"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function DashboardPage() {
    const router = useRouter();
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Your Dashboard</h1>
        <p className="text-muted-foreground">
          Get started by adding your first book to your collection.
        </p>
        <Button onClick={() => router.push('/dashboard/books/new')} className="mt-4">
          Add New Book
        </Button>
      </div>
    </div>);
}
