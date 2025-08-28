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
// Define the handler with explicit types
const handler = async (
  req: NextRequest,
  context: {
    params?: Record<string, string>;
    authContext: AuthContextUnion;
  } = { 
    authContext: { 
      type: 'github-oidc',
      userId: 'system',
      claims: { 
        sub: 'system',
        iss: 'https://token.actions.githubusercontent.com',
        aud: 'https://api.clerko.com',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
        repository: 'system/repo',
        repository_owner: 'system',
        run_id: '1',
        workflow: 'system-workflow',
        actor: 'system',
        ref: 'refs/heads/main',
        sha: 'a1b2c3d4e5f6g7h8i9j0',
        event_name: 'workflow_dispatch'
      },
      repository: 'system/repo',
      repositoryOwner: 'system',
      actor: 'system',
      ref: 'refs/heads/main',
      sha: 'a1b2c3d4e5f6g7h8i9j0',
      workflow: 'system-workflow',
      runId: '1'
    } 
  }
): Promise<NextResponse> => {
  const { params = {}, authContext } = context || {};
  const oidcClaims = authContext as any;
  const id = params?.id;
  
  if (!id) {
    return NextResponse.json(
      { error: 'Book ID is required' },
      { status: 400 }
    );
  }
  try {
    // Log OIDC context for audit
    logger.info('OIDC-authenticated EPUB update request', {
      repository: oidcClaims.repository,
      workflow: oidcClaims.workflow,
      run_id: oidcClaims.run_id,
      bookId: params.id
    });

    // Extract book ID from params
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'missing_book_id', message: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Validate book ID format (should be a valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
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
        console.error('Validation error:', validation.error);
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
      logger.error('Error updating EPUB URL', { error, bookId: id });
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
        console.error('Book not found or not updated:', id);
        return NextResponse.json(
          { error: 'book_not_found', message: 'Book not found or could not be updated' }, 
          { status: 404 }
        );
      }

      console.log('Successfully updated book with EPUB URL:', {
        bookId: updated.id,
        epubUrl: updated.epubUrl
      });

      return NextResponse.json({ 
        success: true, 
        id: updated.id, 
        epubUrl: updated.epubUrl
      });
    } catch (dbError) {
      console.error('Database error during update:', dbError);
      return NextResponse.json(
        { 
          error: 'database_error', 
          message: 'Failed to update book with EPUB URL',
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }, 
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Unexpected error in EPUB callback:', err);
    return NextResponse.json(
      { 
        error: 'internal_server_error', 
        message: 'An unexpected error occurred',
        details: err instanceof Error ? err.message : String(err)
      }, 
      { status: 500 }
    );
  }
}

// Export the handler wrapped with GitHub OIDC auth middleware
// Export the handler wrapped with GitHub OIDC auth middleware
export const POST = withGithubOidcAuth(handler as HandlerWithAuth);
