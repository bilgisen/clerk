import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { verifySecretToken } from '@/lib/auth/verifySecret';

// Schema for request body validation
const UpdateEpubSchema = z.object({
  epubUrl: z.string().url('Valid EPUB URL is required')
});

// POST /api/books/by-id/[id]/epub
// Protected by secret token. Called by CI after uploading EPUB to R2.
// Headers: { Authorization: 'Bearer PAYLOAD_71y15GYgRYGMe16a4' }
// Body: { epubUrl: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify secret token
    const isAuthenticated = await verifySecretToken(req);
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Extract book ID from params
    const { id } = params;

    // Validate book ID format (should be a valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      console.error('Invalid book ID format:', id);
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
      console.error('Error parsing request body:', error);
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
