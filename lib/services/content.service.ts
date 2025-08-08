import { auth } from "@clerk/nextjs/server";
import { randomUUID } from 'crypto';
import { createToken } from '../auth';

export type EbookFormat = 'epub' | 'mobi' | 'pdf' | 'html' | 'docx';

interface ContentGenerationParams {
  title: string;
  content: string;
  format: EbookFormat;
  metadata?: Record<string, any>;
}

export class ContentService {
  private static async getAuthenticatedUserId() {
    const session = await auth();
    if (!session?.userId) {
      throw new Error('Kullanıcı girişi gerekli');
    }
    return session.userId;
  }

  static async generateContent(params: ContentGenerationParams) {
    const userId = await this.getAuthenticatedUserId();
    const contentId = `content_${randomUUID()}`;
    
    // Validate content
    if (!params.content || params.content.trim().length < 10) {
      throw new Error('İçerik çok kısa');
    }

    // Create a JWT token for this content generation job
    const tokenData = await createToken(userId, {
      metadata: {
        contentId,
        format: params.format,
        ...(params.metadata || {})
      }
    });
    
    if (!tokenData?.token) {
      throw new Error('Failed to generate authentication token');
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

    return {
      contentId,
      jobToken: tokenData.token,
      status: 'processing',
      timestamp: new Date().toISOString(),
      expiresAt: tokenData.expiresAt
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
