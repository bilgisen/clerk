import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withGithubOidcAuth, type HandlerWithAuth, type AuthContextUnion } from '@/middleware/old/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Schema for request body validation
const UpdateEpubSchema = z.object({
  epubUrl: z.string().url('Valid EPUB URL is required')
});

// POST /api/books/by-id/[id]/epub
// Protected by GitHub OIDC. Called by CI after uploading EPUB to R2.
// Headers: { Authorization: 'Bearer <github-oidc-token>' }
// Body: { epubUrl: string }
const handler: HandlerWithAuth = async (
  req: NextRequest,
  context = {
    params: { id: '' },
    authContext: {
      type: 'github-oidc' as const,
      userId: 'system',
      claims: {
        sub: 'system',
        iss: 'https://token.actions.githubusercontent.com',
        aud: 'https://api.clerko.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        repository: 'system/repo',
        repository_owner: 'system',
        workflow: 'system-workflow',
        run_id: '1',
        actor: 'system',
        ref: 'refs/heads/main',
        sha: 'a1b2c3d4e5f6g7h8i9j0',
        event_name: 'workflow_dispatch'
      },
      repository: 'system/repo',
      repositoryOwner: 'system',
      workflow: 'system-workflow',
      runId: '1',
      actor: 'system',
      ref: 'refs/heads/main',
      sha: 'a1b2c3d4e5f6g7h8i9j0'
    }
  }
) => {
  try {
    const { id } = context.params || {};
    const oidcClaims = context.authContext as AuthContextUnion & { type: 'github-oidc' };
    
    if (!id) {
      return NextResponse.json(
        { error: 'book_id_required', message: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Log OIDC context for audit
    logger.info('OIDC-authenticated EPUB update request', {
      repository: oidcClaims.repository,
      workflow: oidcClaims.workflow,
      runId: oidcClaims.runId,
      bookId: id
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

// Export the handler wrapped with GitHub OIDC auth middleware
export const POST = withGithubOidcAuth(handler as unknown as HandlerWithAuth);
