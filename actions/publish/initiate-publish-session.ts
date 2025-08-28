'use server';

import { auth } from '@clerk/nextjs';
import { revalidatePath } from 'next/cache';
import { generateId } from '@/lib/utils';
import { redis } from '@/lib/redis/client';

interface InitiatePublishSessionParams {
  bookId: string;
  format: string;
  metadata: {
    title: string;
    slug: string;
    [key: string]: any;
  };
}

export async function initiatePublishSession({
  bookId,
  format,
  metadata,
}: InitiatePublishSessionParams): Promise<{ sessionId: string }> {
  const { userId, orgId } = auth();
  
  if (!userId) {
    throw new Error('You must be signed in to publish a book');
  }

  // Generate a unique session ID
  const sessionId = `sess_${generateId(16)}`;
  const timestamp = Date.now();
  
  // Create session data
  const sessionData = {
    id: sessionId,
    bookId,
    userId,
    orgId: orgId || null,
    format,
    status: 'initializing',
    progress: 0,
    metadata: {
      ...metadata,
      startedAt: new Date().toISOString(),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    // Store session in Redis with 24-hour expiration
    await redis.set(
      `publish:${sessionId}`, 
      JSON.stringify(sessionData),
      { ex: 60 * 60 * 24 } // 24 hours
    );
    
    // Update user's recent sessions
    const userSessionsKey = `user:${userId}:publish_sessions`;
    await redis.lpush(userSessionsKey, sessionId);
    await redis.ltrim(userSessionsKey, 0, 9); // Keep only the 10 most recent sessions
    
    // Revalidate any relevant paths
    revalidatePath(`/dashboard/books/${metadata.slug}/publish`);
    
    return { sessionId };
  } catch (error) {
    console.error('Failed to initiate publish session:', error);
    throw new Error('Failed to start publishing session. Please try again.');
  }
}

// Helper function to get session data
export async function getPublishSession(sessionId: string) {
  try {
    const sessionData = await redis.get(`publish:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error('Error getting publish session:', error);
    return null;
  }
}

// Helper function to update session data
export async function updatePublishSession(
  sessionId: string, 
  updates: Record<string, any>
) {
  try {
    const session = await getPublishSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };
    
    await redis.set(
      `publish:${sessionId}`, 
      JSON.stringify(updatedSession),
      { ex: 60 * 60 * 24 } // Reset TTL to 24 hours
    );
    
    return updatedSession;
  } catch (error) {
    console.error('Error updating publish session:', error);
    throw new Error('Failed to update publishing session');
  }
}
