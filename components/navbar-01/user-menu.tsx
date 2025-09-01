'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { user, signOut } = useAuth();
  
  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">{user.email}</span>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => signOut()}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
