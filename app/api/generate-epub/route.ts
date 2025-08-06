import { NextResponse } from 'next/server';
import { generateEPUBBuffer } from '@/lib/epub/generateEPUBBuffer';
import { generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';

export async function POST(request: Request) {
  try {
    const { book, chapters } = await request.json();

    if (!book || !chapters) {
      return NextResponse.json(
        { error: 'Book and chapters are required' },
        { status: 400 }
      );
    }

    // Generate the HTML content for the book
    const html = generateCompleteDocumentHTML(book, chapters);
    
    // Generate the EPUB buffer
    const epubBuffer = await generateEPUBBuffer(book, chapters, html);

    // Return the EPUB file as a response
    return new NextResponse(epubBuffer, {
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${book.slug || 'book'}.epub"`,
      },
    });
  } catch (error) {
    console.error('Error generating EPUB:', error);
    return NextResponse.json(
      { error: 'Failed to generate EPUB', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
