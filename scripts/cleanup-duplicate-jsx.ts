import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

async function findAndRemoveDuplicates(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await findAndRemoveDuplicates(fullPath);
    } else if (entry.name.endsWith('.jsx')) {
      const tsxPath = path.join(dir, entry.name.replace(/\.jsx$/, '.tsx'));
      
      try {
        // Check if corresponding .tsx file exists
        await stat(tsxPath);
        
        // If we get here, the .tsx file exists
        console.log(`Removing duplicate: ${fullPath} (found ${tsxPath})`);
        await unlink(fullPath);
      } catch (err) {
        // .tsx file doesn't exist, keep the .jsx file
        console.log(`Keeping: ${fullPath} (no TypeScript equivalent found)`);
      }
    }
  }
}

// Start from the components directory
const componentsDir = path.join(__dirname, '..', 'components');

findAndRemoveDuplicates(componentsDir)
  .then(() => console.log('Cleanup complete!'))
  .catch(console.error);
