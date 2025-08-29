const fs = require('fs').promises;
const path = require('path');

// List of files that need updating
const filesToUpdate = [
  'app/api/publish/init/route.ts',
  'app/api/publish/update/route.ts',
];

async function updateFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = await fs.readFile(fullPath, 'utf8');
    
    // Update the import path
    const updatedContent = content.replace(
      /from\s+['"]@\/lib\/session-utils['"]/g,
      'from \'@/lib/publish/session-utils\''
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
  console.log('Updating session utility imports...');
  for (const file of filesToUpdate) {
    await updateFile(file);
  }
  console.log('✅ All files processed');
}

main();
