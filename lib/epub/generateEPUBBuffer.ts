import { Book, Chapter } from '@/types';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EpubBook, EpubOptions } from 'epub-gen-memory';

export async function generateEPUBBuffer(
  book: Book,
  chapters: Chapter[],
  htmlContent: string
): Promise<Buffer> {
  const options: EpubOptions = {
    title: book.title,
    author: book.author || 'Unknown Author',
    description: book.description || '',
    publisher: book.publisher || '',
    cover: book.coverImage ? await getImageAsBase64(book.coverImage) : undefined,
    content: [
      {
        title: 'Table of Contents',
        data: generateTOC(chapters),
      },
      {
        title: 'Content',
        data: htmlContent,
      },
    ],
  };

  try {
    const epub = new EpubBook(options);
    const buffer = await epub.genEpub({ type: 'buffer' });
    return buffer as Buffer;
  } catch (error) {
    console.error('Error generating EPUB:', error);
    throw new Error('Failed to generate EPUB');
  }
}

function generateTOC(chapters: Chapter[]): string {
  return `
    <h1>Table of Contents</h1>
    <nav>
      <ol>
        ${chapters
          .map(
            (chapter) =>
              `<li><a href="#chapter-${chapter.id}">${chapter.title}</a></li>`
          )
          .join('\n')}
      </ol>
    </nav>
  `;
}

async function getImageAsBase64(imagePath: string): Promise<string> {
  try {
    const imageBuffer = await fs.promises.readFile(
      path.join(process.cwd(), 'public', imagePath)
    );
    const mimeType = path.extname(imagePath).slice(1) || 'jpeg';
    return `data:image/${mimeType};base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error reading cover image:', error);
    throw new Error('Failed to process cover image');
  }
}
