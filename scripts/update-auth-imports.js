const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/api/books/by-id/[id]/epub/route.ts',
  'app/api/books/by-id/[id]/payload/route.ts',
  'app/api/books/by-slug/[slug]/chapters/[chapterId]/html/route.ts',
  'app/api/books/by-slug/[slug]/imprint/route.ts',
  'app/api/ci/process/route.ts',
  'app/api/content/generate/route.ts'
];

const updateFile = (filePath) => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Update AuthContextUnion and SessionAuthContext imports
    content = content.replace(
      /import\s*{[^}]*\bAuthContextUnion\b[^}]*}\s*from\s*['"]@\/middleware\/auth['"]/g,
      'import type { AuthContextUnion } from \'@/types/auth.types\''
    );
    
    content = content.replace(
      /import\s*{[^}]*\bSessionAuthContext\b[^}]*}\s*from\s*['"]@\/middleware\/auth['"]/g,
      'import type { SessionAuthContext } from \'@/types/auth.types\''
    );
    
    // Update middleware imports to only include what's needed
    content = content.replace(
      /import\s*{[^}]*\bwithSessionAuth\b[^}]*}\s*from\s*['"]@\/middleware\/auth['"]/g,
      'import { withSessionAuth } from \'@/middleware/auth\''
    );
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
};

// Run updates
console.log('Updating auth imports...');
filesToUpdate.forEach(updateFile);
console.log('Done!');
