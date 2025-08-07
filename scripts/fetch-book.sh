#!/bin/bash
set -e

echo "📥 Fetching book payload for content ID: $CONTENT_ID"

# Create necessary directories
mkdir -p ./book-content/chapters

# Set up the payload URL
PAYLOAD_URL="$BASE_URL/api/books/by-id/$CONTENT_ID/payload"
echo "🔗 Payload URL: $PAYLOAD_URL"

# Debug: Print environment info
echo "🔧 Environment:"
echo "- BASE_URL: $BASE_URL"
echo "- JWT_ISSUER: ${JWT_ISSUER:-Not set}"
echo "- JWT_AUDIENCE: ${JWT_AUDIENCE:-Not set}"

# Make the request with verbose output and save headers for debugging
echo "🔐 Making request with JWT token..."
if ! curl -v -s -f -L -o ./book-content/payload.json \
     -H "Authorization: $JWT_HEADER" \
     -H "Accept: application/json" \
     -D ./response_headers.txt \
     "$PAYLOAD_URL" 2> curl_debug.log; then
  
  echo "::error::❌ Failed to fetch book payload"
  echo "=== Response Headers ==="
  cat ./response_headers.txt 2>/dev/null || echo "No response headers"
  echo -e "\n=== cURL Debug Log ==="
  cat curl_debug.log 2>/dev/null || echo "No debug log"
  exit 1
fi

# Check for empty response
if [ ! -s "./book-content/payload.json" ]; then
  echo "::error::❌ Received empty payload"
  echo "=== Response Headers ==="
  cat ./response_headers.txt 2>/dev/null || echo "No response headers"
  exit 1
fi

# Check for redirect in response
echo -e "\n✅ Payload received. Checking content..."
if grep -q "redirect" ./book-content/payload.json; then
  echo "::error::🔁 Redirect detected - authentication may have failed"
  echo "=== Response Content ==="
  cat ./book-content/payload.json
  echo -e "\n=== Response Headers ==="
  cat ./response_headers.txt 2>/dev/null || echo "No response headers"
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
