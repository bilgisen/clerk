"use client";

import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { User } from "@/db/schema";

// Extend the User type to match the database schema
type ExtendedUser = User & {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  lastActiveAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function Row({
  desc,
  value,
  children,
}: {
  desc: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-8.5 grid grid-cols-2 items-center relative">
      <span className="text-xs font-semibold block shrink-0">{desc}</span>
      <span className="text-xs text-[#7D7D7E] font-mono block relative">
        <span className="block truncate w-full">{value}</span>
        {children}
      </span>
    </div>
  );
}

function PointerC({ label }: { label: string }) {
  return (
    <div className="absolute w-fit flex items-center gap-5 top-1/2 -translate-y-1/2 left-full">
      <div className="relative">
        <div className="h-px bg-[#BFBFC4] w-26" />
        <div className="size-1 bg-[#BFBFC4] rotate-45 absolute right-0 top-1/2 -translate-y-1/2" />
      </div>
      <div className="font-mono text-xs bg-black px-1.5 py-1 rounded-md text-white">
        {label}
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateWithNumbers(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function UserDetails() {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return null;
  
  // Define session object with proper typing
  interface SessionData {
    id: string;
    status: string;
    lastActiveAt: Date | null;
    expireAt: Date;
  }
  
  const session: SessionData = { 
    id: user.id,
    status: 'active',
    lastActiveAt: user.lastLoginAt || null,
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  };
  
  const userData = user as unknown as ExtendedUser;
  const displayName = userData.firstName && userData.lastName 
    ? `${userData.firstName} ${userData.lastName}`
    : userData.email?.split('@')[0] || 'User';

  return (
    <div className="p-16 rounded-lg border border-[#EDEDED] bg-[#F1F1F2] background relative">
      <div className="p-8 rounded-xl bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(25,28,33,0.2)] ring-1 ring-gray-950/5 max-w-100">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-full relative flex justify-center">
            <img 
              src={userData.imageUrl || '/default-avatar.png'} 
              alt={userData.email || 'User'} 
              className="size-20 rounded-full" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/default-avatar.png';
              }}
            />
            <div className="absolute w-fit flex items-center gap-5 top-1/2 -translate-x-2.5 -translate-y-1/2 left-full">
              <div className="relative">
                <div className="h-px bg-[#BFBFC4] w-26" />
                <div className="size-1 bg-[#BFBFC4] rotate-45 absolute right-0 top-1/2 -translate-y-1/2" />
              </div>
              <div className="font-mono text-xs bg-black px-1.5 py-1 rounded-md text-white">
                {userData.imageUrl ? 'Has avatar' : 'No avatar'}
              </div>
            </div>
          </div>
          <h1 className="text-[1.0625rem] font-semibold relative w-full text-center">
            {displayName}
            <div className="absolute w-fit flex items-center gap-5 top-1/2 -translate-x-2.5 -translate-y-1/2 left-full">
              <div className="relative">
                <div className="h-px bg-[#BFBFC4] w-26" />
                <div className="size-1 bg-[#BFBFC4] rotate-45 absolute right-0 top-1/2 -translate-y-1/2" />
              </div>
              <div className="font-mono text-xs bg-black px-1.5 py-1 rounded-md text-white">
                {userData.firstName && userData.lastName ? 'user.name' : 'user.email'}
              </div>
            </div>
          </h1>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-muted-foreground">
              {userData.email || 'No email'}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <Row 
            desc="User ID" 
            value={userData.id}
          >
            <PointerC label="user.id" />
          </Row>
          {userData.lastActiveAt && (
            <Row 
              desc="Last active" 
              value={formatDate(new Date(userData.lastActiveAt))}
            >
              <PointerC label="user.lastActiveAt" />
            </Row>
          )}
          <Row 
            desc="Created" 
            value={userData.createdAt ? formatDate(new Date(userData.createdAt)) : 'Unknown'}
          >
            <PointerC label="user.createdAt" />
          </Row>
          <Row 
            desc="Updated" 
            value={userData.updatedAt ? formatDate(new Date(userData.updatedAt)) : 'Unknown'}
          >
            <PointerC label="user.updatedAt" />
          </Row>
        </div>
        <h2 className="mt-6 mb-4 text-[0.9375rem] font-semibold">
          Session details
        </h2>
        <div className="px-2.5 bg-[#FAFAFB] rounded-lg divide-y divide-[#EEEEF0]">
          <Row desc="Session ID" value={session.id}>
            <PointerC label="session.id" />
          </Row>
          <Row desc="Status" value="active">
            <PointerC label="session.status" />
          </Row>
          {userData.lastActiveAt && (
            <Row 
              desc="Last active" 
              value={formatDate(new Date(userData.lastActiveAt))}
            >
              <PointerC label="user.lastActiveAt" />
            </Row>
          )}
          <Row 
            desc="Expires" 
            value={session.expireAt ? formatDate(new Date(session.expireAt)) : 'Unknown'}
          >
            <PointerC label="session.expireAt" />
          </Row>
        </div>
      </div>
    </div>
  );
}
