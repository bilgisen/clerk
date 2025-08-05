'use client';

import { UserButton } from "@clerk/nextjs";

export function UserMenu() {
  return (
    <div className="flex items-center">
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
