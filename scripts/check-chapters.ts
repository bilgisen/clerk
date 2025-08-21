// scripts/check-chapters.ts
import { db } from '../db/drizzle';
import { chapters } from '../db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import 'dotenv/config';

async function checkChapters() {
  try {
    // Get all chapters
    const allChapters = await db.query.chapters.findMany({
      limit: 10, // Just check first 10 for now
    });

    console.log('First 10 chapters with parent IDs:');
    allChapters.forEach(chapter => {
      console.log({
        id: chapter.id,
        title: chapter.title,
        parentChapterId: chapter.parentChapterId,
        hasParent: !!chapter.parentChapterId,
        order: chapter.order,
        level: chapter.level
      });
    });

    // Check if any chapters have parents
    const chaptersWithParents = await db.query.chapters.findMany({
      where: (chapters, { isNotNull }) => isNotNull(chapters.parentChapterId),
      limit: 5
    });

    console.log('\nChapters with parents:', chaptersWithParents.length);
    if (chaptersWithParents.length > 0) {
      console.log('Example chapter with parent:', {
        id: chaptersWithParents[0].id,
        title: chaptersWithParents[0].title,
        parentId: chaptersWithParents[0].parentChapterId
      });
    }

    // Check the schema
    console.log('\nChapter table schema:');
    const result = await db.execute(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'chapters' 
       AND table_schema = 'public'`
    );
    
    console.log(result.rows);

  } catch (error) {
    console.error('Error checking chapters:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    }
  } finally {
    process.exit(0);
  }
}

checkChapters();
