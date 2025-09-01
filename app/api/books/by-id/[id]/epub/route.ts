import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { 
  withSessionAuth, 
  type AuthContextUnion, 
  type BaseAuthContext,
  type HandlerWithAuth,
  isSessionAuthContext
} from '@/middleware/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Schema for request body validation
const UpdateEpubSchema = z.object({
  epubUrl: z.string().url('Valid EPUB URL is required')
});

// POST /api/books/by-id/[id]/epub
// Protected by session auth. Called after uploading EPUB to R2.
// Body: { epubUrl: string }
const handler: HandlerWithAuth<{ id: string }> = async (
  req: NextRequest,
  context: BaseAuthContext<{ id: string }>
) => {
  try {
    const { id } = context.params || {};
    
    if (!isSessionAuthContext(context.authContext)) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: 'book_id_required', message: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Log the EPUB update request for audit
    logger.info('EPUB update request', {
      bookId: id,
      userId: context.authContext.userId
    });

    // Validate book ID format (should be a valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      logger.error('Invalid book ID format', { bookId: id });
      return NextResponse.json(
        { error: 'invalid_book_id', message: 'Invalid book ID format' }, 
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
      const validation = UpdateEpubSchema.safeParse(body);
      
      if (!validation.success) {
        logger.error('Validation error', { error: validation.error });
        return NextResponse.json(
          { 
            error: 'validation_error', 
            message: 'Invalid request body',
            details: validation.error.format()
          }, 
          { status: 400 }
        );
      }
      
      body = validation.data;
    } catch (error) {
      logger.error('Error parsing request body', { error });
      return NextResponse.json(
        { error: 'invalid_json', message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Update the book with the new EPUB URL
    try {
      const [updated] = await db
        .update(books)
        .set({ 
          epubUrl: body.epubUrl, 
          updatedAt: new Date() 
        })
        .where(eq(books.id, id))
        .returning();

      if (!updated) {
        logger.error('Book not found or not updated', { bookId: id });
        return NextResponse.json(
          { error: 'book_not_found', message: 'Book not found or could not be updated' }, 
          { status: 404 }
        );
      }

      logger.info('Successfully updated book with EPUB URL', {
        bookId: updated.id,
        epubUrl: updated.epubUrl
      });

      return NextResponse.json({ 
        success: true, 
        id: updated.id, 
        epubUrl: updated.epubUrl
      });
    } catch (dbError) {
      logger.error('Database error during update', { error: dbError });
      return NextResponse.json(
        { 
          error: 'database_error', 
          message: 'Failed to update book with EPUB URL',
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unexpected error in EPUB callback', { error });
    return NextResponse.json(
      { 
        error: 'internal_server_error', 
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
};

// Export the handler wrapped with session auth middleware
export const POST = withSessionAuth(handler);

// Add handler type declaration
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      R2_PUBLIC_URL: string;
      R2_ACCESS_KEY_ID: string;
      R2_SECRET_ACCESS_KEY: string;
      R2_BUCKET_NAME: string;
      R2_ENDPOINT: string;
      R2_REGION: string;
    }
  }
}
