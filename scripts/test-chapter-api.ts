import { db } from '../db/drizzle';
import { chapters } from '../db/schema';
import { eq } from 'drizzle-orm';

// Test data
const testBookId = '123e4567-e89b-12d3-a456-426614174000';
const testChapter = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  bookId: testBookId,
  title: 'Test Chapter',
  content: 'This is a test chapter',
  order: 1,
  level: 1,
  parentChapterId: null,
  isDraft: false,
  slug: 'test-chapter',
  userId: '123e4567-e89b-12d3-a456-426614174002',
};

async function testChapterApi() {
  try {
    console.log('Starting chapter API tests...');
    
    // Clean up any existing test data
    await db.delete(chapters).where(eq(chapters.id, testChapter.id));
    
    // Test 1: Create a chapter (via direct DB insert for testing)
    console.log('\nTest 1: Creating a test chapter...');
    const [createdChapter] = await db
      .insert(chapters)
      .values(testChapter)
      .returning();
    
    console.log('Created chapter:', JSON.stringify(createdChapter, null, 2));
    
    // Test 2: Get the chapter via API
    console.log('\nTest 2: Getting the test chapter via API...');
    const getResponse = await fetch(`http://localhost:3000/api/chapters/${testChapter.id}`);
    const chapterData = await getResponse.json();
    
    console.log('API Response Status:', getResponse.status);
    console.log('Chapter data from API:', JSON.stringify(chapterData, null, 2));
    
    if (getResponse.status !== 200) {
      throw new Error('Failed to get chapter');
    }
    
    // Test 3: Update the chapter
    console.log('\nTest 3: Updating the test chapter...');
    const updateResponse = await fetch(`http://localhost:3000/api/chapters/${testChapter.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Updated Test Chapter',
        content: 'This is an updated test chapter',
      }),
    });
    
    const updatedChapter = await updateResponse.json();
    console.log('Update response status:', updateResponse.status);
    console.log('Updated chapter:', JSON.stringify(updatedChapter, null, 2));
    
    if (updateResponse.status !== 200) {
      throw new Error('Failed to update chapter');
    }
    
    // Test 4: Delete the chapter
    console.log('\nTest 4: Deleting the test chapter...');
    const deleteResponse = await fetch(`http://localhost:3000/api/chapters/${testChapter.id}`, {
      method: 'DELETE',
    });
    
    const deleteResult = await deleteResponse.json();
    console.log('Delete response status:', deleteResponse.status);
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2));
    
    if (deleteResponse.status !== 200) {
      throw new Error('Failed to delete chapter');
    }
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    await db.delete(chapters).where(eq(chapters.id, testChapter.id));
  }
}

testChapterApi();
