import { NextResponse } from 'next/server';
import { withGithubOidc, AuthedRequest } from '@/lib/middleware/withGithubOidc';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/books/by-id/[id]/epub
// Protected by GitHub OIDC. Called by CI after uploading EPUB to R2.
// Body: { epubUrl: string }
export const POST = withGithubOidc(async (req: AuthedRequest) => {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').filter(Boolean).pop();

    if (!id) {
      return NextResponse.json({ error: 'missing_book_id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const epubUrl = typeof body?.epubUrl === 'string' ? body.epubUrl.trim() : '';
    if (!epubUrl || !/^https?:\/\//i.test(epubUrl)) {
      return NextResponse.json({ error: 'invalid_epub_url' }, { status: 400 });
    }

    const [updated] = await db
      .update(books)
      .set({ epubUrl, updatedAt: new Date() })
      .where(eq(books.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'book_not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: updated.id, epubUrl: updated.epubUrl });
  } catch (err) {
    console.error('CI EPUB callback failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
});
