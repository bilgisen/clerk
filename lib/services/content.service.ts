import { auth } from "@/lib/auth/better-auth";
import { randomUUID } from 'crypto';
import type { Headers } from 'next/headers';

export type EbookFormat = 'epub' | 'mobi' | 'pdf' | 'html' | 'docx';

export interface ContentGenerationParams {
  title: string;
  content: string;
  format: EbookFormat;
  metadata?: Record<string, any>;
  headers?: Headers;
}

export class ContentService {
  /**
   * Get the authenticated user ID from request headers
   * @param headers Request headers containing the session cookie
   * @returns The authenticated user ID
   * @throws Error if user is not authenticated
   */
  private static async getAuthenticatedUserId(headers?: Headers): Promise<string> {
    if (!headers) {
      throw new Error('Request headers are required for authentication');
    }

    const session = await auth.api.getSession({ headers });
    
    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }
    
    return session.user.id;
  }

  /**
   * Generate content with the given parameters
   * @param params Content generation parameters including request headers
   * @returns Object containing content ID and status
   */
  static async generateContent(params: ContentGenerationParams) {
    if (!params.headers) {
      throw new Error('Request headers are required for authentication');
    }
    
    const userId = await this.getAuthenticatedUserId(params.headers);
    const contentId = `content_${randomUUID()}`;
    
    // Validate content
    if (!params.content || params.content.trim().length < 10) {
      throw new Error('Content is too short');
    }

    // Prepare content for processing
    const contentData = {
      id: contentId,
      userId,
      title: params.title,
      content: params.content,
      format: params.format,
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata: params.metadata || {}
    };

    // In a real app, you would save this to a database
    // await db.content.create({ data: contentData });

    // Return the content ID for client-side use
    return {
      contentId,
      status: 'pending'
    };
  }

  static async getContentStatus(contentId: string) {
    // In a real app, fetch from your database
    // const content = await db.content.findUnique({ where: { id: contentId } });
    return {
      contentId,
      status: 'completed', // or 'processing', 'failed'
      downloadUrl: `/api/content/download/${contentId}`,
      lastUpdated: new Date().toISOString()
    };
  }
}
