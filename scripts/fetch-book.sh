#!/bin/bash
set -e

echo "📥 Fetching book payload for content ID: $CONTENT_ID"

mkdir -p ./book-content/chapters

PAYLOAD_URL="$BASE_URL/api/books/by-id/$CONTENT_ID/payload"
echo "🔗 Payload URL: $PAYLOAD_URL"
echo "🔐 Using JWT_HEADER: $JWT_HEADER"

if ! curl -s -f -L -o ./book-content/payload.json \
     -H "Authorization: $JWT_HEADER" \
     -H "Accept: application/json" \
     "$PAYLOAD_URL"; then
  echo "::error::❌ Failed to fetch book payload"
  exit 1
fi

echo "✅ Payload fetched. Checking for redirect or empty content..."
head -n 20 ./book-content/payload.json

if grep -q "redirect" ./book-content/payload.json; then
  echo "::error::🔁 Redirect detected - token may be invalid"
  cat ./book-content/payload.json
  exit 5
fi

# Extract metadata
BOOK_TITLE=$(jq -r '.book.title // "Untitled Book"' ./book-content/payload.json)
BOOK_LANG=$(jq -r '.book.language // "en"' ./book-content/payload.json)
COVER_URL=$(jq -r '.book.cover_url // empty' ./book-content/payload.json)
STYLESHEET_URL=$(jq -r '.book.stylesheet_url // empty' ./book-content/payload.json)
TOC_DEPTH=$(jq -r '.options.toc_depth // 2' ./book-content/payload.json)

echo "📖 Title: $BOOK_TITLE"
echo "🌐 Language: $BOOK_LANG"
echo "🖼️  Cover: $COVER_URL"
echo "🎨 Stylesheet: $STYLESHEET_URL"
echo "📚 TOC Depth: $TOC_DEPTH"

# Download cover
if [ -n "$COVER_URL" ]; then
  echo "⬇️ Downloading cover..."
  curl -s -f -L -H "Authorization: $JWT_HEADER" -o ./book-content/cover.jpg "$COVER_URL" || echo "⚠️ Warning: Failed to download cover"
fi

# Download stylesheet
if [ -n "$STYLESHEET_URL" ]; then
  echo "⬇️ Downloading stylesheet..."
  mkdir -p ./book-content/styles
  curl -s -f -L -H "Authorization: $JWT_HEADER" -o ./book-content/styles/epub.css "$STYLESHEET_URL" || echo "⚠️ Warning: Failed to download stylesheet"
fi

# Extract chapter list
echo "📄 Extracting chapters..."
if ! jq -r '.book.chapters[] | "\(.order) \(.url)"' ./book-content/payload.json > ./book-content/chapters-list.txt; then
  echo "::error::❌ Failed to parse chapter list"
  exit 2
fi

CHAPTER_COUNT=$(wc -l < ./book-content/chapters-list.txt)
echo "✅ Found $CHAPTER_COUNT chapters"

# Download chapters in batch
BATCH_SIZE=5
for ((i=0; i<CHAPTER_COUNT; i+=BATCH_SIZE)); do
  echo "📥 Processing chapters $((i+1))-$((i+BATCH_SIZE))"
  tail -n +$((i+1)) ./book-content/chapters-list.txt | head -n $BATCH_SIZE | while read -r ORDER URL; do
    echo "🔸 Downloading chapter $ORDER..."
    if ! curl -s -f -L -H "Authorization: $JWT_HEADER" -o "./book-content/chapters/chapter-${ORDER}.xhtml" "$URL"; then
      echo "::warning::⚠️ Failed to download chapter $ORDER"
    fi
  done
  sleep 1
done

# Download imprint if needed
if [ "$(jq -r '.options.include_imprint // false' ./book-content/payload.json)" = "true" ]; then
  IMPRINT_URL=$(jq -r '.book.imprint.url // empty' ./book-content/payload.json)
  if [ -n "$IMPRINT_URL" ]; then
    echo "⬇️ Downloading imprint..."
    curl -s -f -L -H "Authorization: $JWT_HEADER" -o ./book-content/imprint.xhtml "$IMPRINT_URL" || echo "⚠️ Warning: Failed to download imprint"
  fi
fi

echo "✅ All book content fetched successfully"
