const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/dashboard/books/[slug]/chapters/[chapterId]/edit/page.tsx',
  'app/dashboard/books/[slug]/chapters/[chapterId]/page.tsx',
  'app/dashboard/books/[slug]/chapters/new/page.tsx',
  'app/dashboard/books/[slug]/edit/page.tsx',
  'app/dashboard/books/[slug]/publish/ebook/page.tsx',
  'app/dashboard/books/[slug]/publish/page.tsx',
  'app/dashboard/books/books-client.tsx',
  'app/dashboard/books/new/page.tsx',
  'app/pricing/page.tsx',
  'hooks/api/use-chapters.ts'
];

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace default import with named import
    const updatedContent = content.replace(
      /import\s+toast\s+from\s+['"]sonner['"]/g,
      'import { toast } from "sonner"'
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`No changes needed: ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('Sonner import fixes completed!');
