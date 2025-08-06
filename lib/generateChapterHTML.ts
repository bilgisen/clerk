import type { Book, Chapter } from '@/db/schema';

/**
 * Interface for book metadata used in imprint generation
 */
interface BookImprintData {
  title: string;
  author: string;
  publisher?: string | null;
  publisherWebsite?: string | null;
  publishYear?: number | null;
  isbn?: string | null;
  language?: string;
  description?: string | null;
  coverImageUrl?: string | null;
}

interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

/**
 * Generates HTML content for a single chapter
 */
export function generateChapterHTML(chapter: Chapter, children: Chapter[] = [], book: BookWithChapters): string {
  const { title, content, level = 1, order = 0, id } = chapter;
  const headingLevel = Math.min((level || 1) + 1, 6); // Ensure we don't go beyond h6
  const chapterId = `ch-${String(order).padStart(3, '0')}`;
  
  // Find parent chapter if exists
  const parentChapter = chapter.parentChapterId 
    ? book.chapters?.find(c => c.id === chapter.parentChapterId)
    : null;
  
  // Generate chapter metadata
  const metadata: ChapterMetadata = {
    book: book.title,
    chapter_id: chapterId,
    parent_chapter: parentChapter ? `ch-${String(parentChapter.order || 0).padStart(3, '0')}` : undefined,
    order: order || 0,
    level: level || 1,
    title_tag: `h${headingLevel}`,
    title: title || 'Untitled Chapter'
  };
  
  // Generate the chapter content with proper heading
  let html = `
    <section id="${chapterId}" class="chapter" data-chapter-id="${id}" data-level="${level || 1}">
      <h${headingLevel} class="chapter-title">${title}</h${headingLevel}>
      <div class="chapter-content">
        ${content || ''}
      </div>
  `;

  // Add child chapters if they exist
  if (children && children.length > 0) {
    html += '\n  <div class="nested-chapters">';
    children.forEach(child => {
      const grandChildren = book.chapters?.filter(c => c.parentChapterId === child.id) || [];
      html += generateChapterHTML(child, grandChildren, book);
    });
    html += '\n  </div>';
  }

  html += '\n</section>';
  
  // Return just the HTML fragment without wrapping in a complete document
  // The complete document will be handled by generateCompleteChapterHTML
  return html;
}

/**
 * Generates a complete HTML document with the provided chapter content
 */
export function generateCompleteChapterHTML(chapter: Chapter, children: Chapter[], book: BookWithChapters): string {
  // Generate the chapter HTML with metadata
  const content = generateChapterHTML(chapter, children, book);
  
  // If the content is already a complete document (from generateChapterHTML), 
  // extract just the body content to avoid nested HTML documents
  if (content.includes('<!DOCTYPE html>')) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      // Extract just the body content
      const bodyContent = bodyMatch[1].trim();
      
      // Create metadata for the complete document
      const metadata: Partial<ChapterMetadata> = {
        book: book.title || 'untitled',
        chapter_id: `ch-${String(chapter.order || 0).padStart(3, '0')}`,
        order: chapter.order || 0,
        level: chapter.level || 1,
        title_tag: `h${Math.min((chapter.level || 1) + 1, 6)}`,
        title: chapter.title || 'Untitled Chapter'
      };
      
      // If there's a parent chapter, add its ID to metadata
      if (chapter.parentChapterId) {
        const parentChapter = book.chapters?.find(c => c.id === chapter.parentChapterId);
        if (parentChapter) {
          metadata.parent_chapter = `ch-${String(parentChapter.order || 0).padStart(3, '0')}`;
        }
      }
      
      return generateCompleteDocumentHTML(metadata.title || 'Chapter', bodyContent, metadata);
    }
    return content; // Fallback to original content if we can't extract body
  }
  
  // If content is not a complete document, wrap it with metadata
  const metadata: Partial<ChapterMetadata> = {
    book: book.title || 'untitled',
    chapter_id: `ch-${String(chapter.order || 0).padStart(3, '0')}`,
    order: chapter.order || 0,
    level: chapter.level || 1,
    title_tag: `h${Math.min((chapter.level || 1) + 1, 6)}`,
    title: chapter.title || 'Untitled Chapter'
  };
  
  // If there's a parent chapter, add its ID to metadata
  if (chapter.parentChapterId) {
    const parentChapter = book.chapters?.find(c => c.id === chapter.parentChapterId);
    if (parentChapter) {
      metadata.parent_chapter = `ch-${String(parentChapter.order || 0).padStart(3, '0')}`;
    }
  }
  
  return generateCompleteDocumentHTML(metadata.title || 'Chapter', content, metadata);
}

/**
 * Generates an imprint (künye) HTML page for a book
 * @param book The book data to generate the imprint for
 * @returns Complete HTML string for the imprint page
 */
export function generateImprintHTML(book: BookImprintData): string {
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split('T')[0];
  
  // Format publish year if available
  const publishYear = book.publishYear || currentDate.getFullYear();
  
  // Create metadata for the imprint
  const metadata = {
    title: `Imprint | ${book.title}`,
    type: 'imprint',
    book: book.title,
    language: book.language || 'en',
    date: formattedDate,
    publisher: book.publisher || 'Unknown Publisher',
    isbn: book.isbn || '',
  };

  // Generate the HTML content
  const content = `
    <h2>Imprint</h2>

    <div class="section">
      <p>
        <span class="label">Title:</span>
        ${book.title}
      </p>
      <p>
        <span class="label">Author:</span>
        ${book.author || 'Unknown Author'}
      </p>
      <p>
        <span class="label">Publisher:</span>
        ${book.publisher || 'Unknown Publisher'}${book.publishYear ? `, ${publishYear}` : ''}
      </p>
      ${book.isbn ? `
      <p>
        <span class="label">ISBN:</span>
        ${book.isbn}
      </p>` : ''}
      <p>
        <span class="label">Published Date:</span>
        ${currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>

    <div class="section">
      <p>
        <span class="label">Language:</span>
        ${book.language || 'English'}
      </p>
    </div>

    ${book.publisherWebsite ? `
    <div class="section">
      <p>
        <span class="label">Website:</span>
        <a href="${book.publisherWebsite}" target="_blank" rel="noopener noreferrer">
          ${book.publisherWebsite.replace(/^https?:\/\//, '')}
        </a>
      </p>
    </div>` : ''}

    <div class="section">
      <p>
        <span class="label">License:</span>
        Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
      </p>
    </div>
  `;

  // Generate the complete HTML document with the provided template
  return `<!DOCTYPE html>
<html lang="${book.language || 'en'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Metadata -->
    <meta name="type" content="${metadata.type}" />
    <meta name="book" content="${metadata.book}" />
    <meta name="language" content="${metadata.language}" />
    <meta name="date" content="${metadata.date}" />
    <meta name="publisher" content="${metadata.publisher}" />
    ${metadata.isbn ? `<meta name="isbn" content="${metadata.isbn}" />` : ''}

    <title>${metadata.title}</title>

    <style>
      body {
        font-family: serif;
        font-size: 1rem;
        line-height: 1.6;
        margin: 3em;
        text-align: justify;
      }

      h2 {
        text-align: center;
        font-size: 1.5rem;
        margin-bottom: 2em;
      }

      .section {
        margin-bottom: 2em;
      }

      .label {
        font-weight: bold;
        margin-right: 0.5em;
      }

      a {
        color: #2563eb;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      @media print {
        body {
          margin: 1.5em;
          font-size: 12pt;
        }
      }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

interface ChapterMetadata {
  book: string;
  chapter_id: string;
  parent_chapter?: string;
  order: number;
  level: number;
  title_tag: string;
  title: string;
}

/**
 * Generates a complete HTML document with the provided chapter content
 * This version includes meta tags and styling as per the provided template
 */
export function generateCompleteDocumentHTML(title: string, content: string, metadata?: Partial<ChapterMetadata>): string {
  // Default metadata values
  const meta: ChapterMetadata = {
    book: 'untitled',
    chapter_id: 'ch-000',
    order: 0,
    level: 1,
    title_tag: 'h1',
    title: title,
    ...metadata
  };

  const parentChapterMeta = meta.parent_chapter ? `
    <meta name="parent_chapter" content="${meta.parent_chapter}" />` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Recommended Metadata -->
    <meta name="book" content="${meta.book}" />
    <meta name="chapter_id" content="${meta.chapter_id}" />${parentChapterMeta}
    <meta name="order" content="${meta.order}" />
    <meta name="level" content="${meta.level}" />
    <meta name="title_tag" content="${meta.title_tag}" />
    <meta name="title" content="${meta.title}" />

    <title>${meta.title} | ${meta.book}</title>

    <style>
      body {
        font-family: serif;
        font-size: 1rem;
        line-height: 1.6;
        margin: 2em;
        max-width: 800px;
        margin: 2em auto;
        padding: 0 2em;
      }

      h1, h2, h3, h4 {
        margin-top: 2em;
        margin-bottom: 1em;
      }

      figure {
        margin: 2em 0;
        text-align: center;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      figcaption {
        font-size: 0.9em;
        color: gray;
        margin-top: 0.5em;
      }

      .footnotes {
        margin-top: 3em;
        font-size: 0.9em;
        border-top: 1px dotted #ccc;
        padding-top: 1em;
      }

      .footnotes ol {
        margin-left: 1.5em;
      }

      .footnotes li {
        margin-bottom: 0.5em;
      }

      a.footnote-ref {
        vertical-align: super;
        font-size: 0.8em;
        text-decoration: none;
      }

      /* Print styles */
      @media print {
        body {
          font-size: 12pt;
          line-height: 1.5;
          margin: 1cm;
          padding: 0;
        }
        
        h1, h2, h3, h4 {
          page-break-after: avoid;
        }
        
        figure {
          page-break-inside: avoid;
        }
        
        .footnotes {
          page-break-before: avoid;
        }
      }
    </style>
  </head>

  <body>
    ${content}
  </body>
</html>`;
}
