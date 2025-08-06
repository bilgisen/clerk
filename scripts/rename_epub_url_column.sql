-- Rename epubUrl to epub_url in the books table
ALTER TABLE books 
RENAME COLUMN "epubUrl" TO "epub_url";

-- Verify the column was renamed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'books' 
AND column_name IN ('epub_url', 'epubUrl');
