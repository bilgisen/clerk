const fs = require('fs').promises;
const path = require('path');

// List of files that need updating
const filesToUpdate = [
  'app/api/books/by-id/[id]/epub/route.ts',
  'app/api/books/by-id/[id]/payload/route.ts',
  'app/api/books/by-slug/[slug]/chapters/[chapterId]/html/route.ts',
  'app/api/books/by-slug/[slug]/imprint/route.ts',
  'app/api/ci/process/route.ts'
];

async function updateFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = await fs.readFile(fullPath, 'utf8');
    
    // Update the import path
    const updatedContent = content.replace(
      /from\s+['"]@\/middleware\/auth['"]/g,
      'from \'@/middleware/old/auth\''
    );
    
    if (content !== updatedContent) {
      await fs.writeFile(fullPath, updatedContent, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('Updating auth imports...');
  for (const file of filesToUpdate) {
    await updateFile(file);
  }
  console.log('✅ All files processed');
}

main();
