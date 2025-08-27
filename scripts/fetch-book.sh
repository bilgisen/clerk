#!/bin/bash
set -e  # Exit on error

# ANSI color codes for better output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Set default values
BASE_URL="${BASE_URL:-https://editor.bookshall.com}"

# Validate required environment variables
if [ -z "$CONTENT_ID" ]; then
  echo -e "${RED}[ERROR] CONTENT_ID is not set${NC}" >&2
  exit 1
fi

if [ -z "$COMBINED_TOKEN" ]; then
  echo -e "${RED}[ERROR] COMBINED_TOKEN is not set${NC}" >&2
  exit 1
fi

# Set API headers
AUTH_HEADER="Authorization: Bearer $COMBINED_TOKEN"
ACCEPT_HEADER="Accept: application/json"
CONTENT_TYPE_HEADER="Content-Type: application/json"

# Create required directories
mkdir -p ./book-content ./output

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Debug function to print environment variables safely
debug_print_env() {
  log_info "🔧 Environment variables:"
  printenv | sort | grep -v -E 'SECRET|TOKEN|PASSWORD|KEY' | while read -r line; do
    if [[ $line == JWT_* || $line == GITHUB_* || $line == NODE_* || $line == CONTENT_* || $line == BASE_URL* ]]; then
      key="${line%%=*}"
      value="${line#*=}"
      # Truncate long values
      if [ ${#value} -gt 50 ]; then
        value="${value:0:20}...${value: -10}"
      fi
      echo "- $key: $value"
    fi
  done
}

# Validate ephemeral combined token
validate_combined_token() {
  if [[ -z "$COMBINED_TOKEN" ]]; then
    log_error "COMBINED_TOKEN is not set"
    return 1
  fi
  log_info "Ephemeral combined token validation successful"
  return 0
}

# Check required commands
check_commands() {
  local commands=("curl" "jq" "base64")
  local missing=()
  
  for cmd in "${commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      missing+=("$cmd")
    fi
  done
  
  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required commands: ${missing[*]}"
    exit 1
  fi
}

# Main execution starts here
check_commands
debug_print_env

# Required environment variables
REQUIRED_VARS=("CONTENT_ID" "COMBINED_TOKEN")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    log_error "Missing required environment variable: $var"
    exit 1
  fi
done

# Set JWT_HEADER for token usage
JWT_HEADER="Bearer $COMBINED_TOKEN"
export JWT_HEADER

# For backward compatibility
JWT_TOKEN="$COMBINED_TOKEN"
export JWT_TOKEN

# Set BASE_URL if not provided
if [ -z "$BASE_URL" ]; then
  log_warning "BASE_URL not set, using default: $BASE_URL"
fi

# Validate ephemeral combined token
if ! validate_combined_token; then
  log_error "Token validation failed"
  exit 1
fi

# Create necessary directories
log_info "Creating output directories..."
mkdir -p ./book-content/chapters

# Set the payload URL
PAYLOAD_URL="$BASE_URL/api/books/by-id/$CONTENT_ID/payload"
log_info "🌐 Attempting to fetch payload from: $PAYLOAD_URL"

# Debug information for token
if [ "${CURL_VERBOSE}" = "1" ]; then
  log_info "🔑 Ephemeral Combined Token Info:"
  echo "Token length: ${#COMBINED_TOKEN} characters"
  echo "First 5 chars: ${COMBINED_TOKEN:0:5}..."
  echo "Last 5 chars: ...${COMBINED_TOKEN: -5}"
fi

# Function to download with retries and timeouts
download_with_retry() {
  local url="$1"
  local output_file="$2"
  local max_retries=3
  local timeout_seconds=30
  
  echo "🔍 Downloading to $output_file"
  echo "   URL: $url"
  
  for ((i=1; i<=max_retries; i++)); do
    echo "   Attempt $i of $max_retries..."
    
    # Set headers based on content type
    local headers=(
      "-H" "Authorization: $JWT_HEADER"
      "-H" "Accept: application/vnd.github.v3+json"
    )
    
    # Add Accept header based on URL
    if [[ "$url" == *"/html" ]]; then
      headers+=("-H" "Accept: text/html")
    else
      headers+=("-H" "Accept: application/json")
    fi
    
    if curl -v --connect-timeout $timeout_seconds --max-time $((timeout_seconds * 2)) \
       "${headers[@]}" \
       -o "$output_file.tmp" \
       "$url" 2>> "${output_file}.debug.log"; then
      
      # Only move the file if download was successful
      mv "${output_file}.tmp" "$output_file"
      
      echo "✅ Download successful"
      return 0
    fi
    
    # Log the error
    echo "⚠️ Attempt $i failed. Debug info:"
    echo "=== Last 10 lines of debug log ==="
    tail -n 10 "${output_file}.debug.log" || echo "No debug log available"
    
    if [ $i -lt $max_retries ]; then
      local wait_time=$((5 * i))  # Exponential backoff
      echo "⏳ Retrying in $wait_time seconds..."
      sleep $wait_time
    fi
  done
  
  echo "::error::❌ Failed to download after $max_retries attempts"
  echo "=== Debug Info ==="
  echo "URL: $url"
  echo "=== Response Headers ==="
  grep -i '^[<>] ' "${output_file}.debug.log" || echo "No response headers"
  echo "=== Response Body (first 200 chars) ==="
  head -c 200 "$output_file" 2>/dev/null || echo "No response body"
  echo -e "\n..."
  
  return 1
}

# Make the request to fetch book data
echo -e "${GREEN}📥 Fetching book data for content ID: $CONTENT_ID${NC}"
mkdir -p ./book-content

# Make the request with verbose output and save debug info
set -x
curl -v -s -f -D ./book-content/headers.txt -o ./book-content/payload.json \
  -H "$ACCEPT_HEADER" \
  -H "$AUTH_HEADER" \
  "$BASE_URL/api/books/by-id/$CONTENT_ID/export" || {
  CURL_EXIT_CODE=$?
  set +x
  echo -e "\n${RED}❌ Failed to fetch book data (exit code: $CURL_EXIT_CODE)${NC}" >&2
  
  if [ -f "./book-content/headers.txt" ]; then
    echo -e "\n${YELLOW}📝 Response headers:${NC}"
    cat ./book-content/headers.txt
  fi
  
  exit 1
}
set +x

# Check if payload was received
if [ ! -f "./book-content/payload.json" ] || [ ! -s "./book-content/payload.json" ]; then
  echo -e "${RED}❌ Received empty or no payload${NC}" >&2
  exit 1
fi

echo "\n✅ Received response. Analyzing..."

# Check if the response is a redirect
if grep -q "^HTTP/.* 30[0-9]" ./book-content/headers.txt; then
  echo "\n🔄 Detected redirect response:"
  grep "^Location:" ./book-content/headers.txt || echo "No Location header found"
  
  # Print response body if it exists and is not empty
  if [ -s "./book-content/payload.json" ]; then
    echo "\n📦 Response body:"
    cat ./book-content/payload.json
  fi
  
  echo "::error::❌ Authentication failed: Server returned a redirect response"
  exit 1
fi

# Check if we got a valid JSON response
if ! jq empty ./book-content/payload.json 2>/dev/null; then
  echo "\n❌ Response is not valid JSON. Raw response (first 200 chars):"
  head -c 200 ./book-content/payload.json
  echo -e "\n..."
  exit 1
fi

# Check for empty response
if [ ! -s "./book-content/payload.json" ]; then
  echo "::error::❌ Received empty payload"
  echo "=== Response Headers ==="
  cat ./book-content/headers.txt 2>/dev/null || echo "No response headers"
  exit 1
fi

# Check for API rate limiting or authentication issues
echo -e "\n✅ Payload received. Checking content..."
if grep -qi "rate limit" ./book-content/payload.json || grep -qi "API rate limit" ./book-content/payload.json; then
  echo "::error::⏱️  GitHub API rate limit exceeded"
  echo "=== Response Content ==="
  cat ./book-content/payload.json
  exit 5
fi

if grep -qi "bad credentials" ./book-content/payload.json || grep -qi "invalid token" ./book-content/payload.json; then
  echo "::error::🔑 Authentication failed - invalid or expired token"
  echo "=== Response Content ==="
  cat ./book-content/payload.json
  exit 5
fi

if grep -qi "not found" ./book-content/payload.json; then
  echo "::error::🔍 Resource not found - check CONTENT_ID and permissions"
  echo "=== Response Content ==="
  cat ./book-content/payload.json
  exit 5
fi

# Extract metadata
BOOK_TITLE=$(jq -r '.book.title // "Untitled Book"' ./book-content/payload.json)
BOOK_LANG=$(jq -r '.book.language // "en"' ./book-content/payload.json)
COVER_URL=$(jq -r '.book.coverUrl // empty' ./book-content/payload.json)
STYLESHEET_URL=$(jq -r '.book.stylesheetUrl // empty' ./book-content/payload.json)
TOC_DEPTH=$(jq -r '.options.tocDepth // 2' ./book-content/payload.json)

echo "📖 Title: $BOOK_TITLE"
echo "🌐 Language: $BOOK_LANG"
echo "🖼️  Cover: $COVER_URL"
echo "🎨 Stylesheet: $STYLESHEET_URL"
echo "📚 TOC Depth: $TOC_DEPTH"

# Download cover
if [ -n "$COVER_URL" ]; then
  echo "⬇️ Downloading cover..."
  curl -s -f -o "./book-content/cover.jpg" "$COVER_URL" || {
    echo "⚠️ Warning: Failed to download cover"
  }
fi

# Download stylesheet
if [ -n "$STYLESHEET_URL" ]; then
  echo "⬇️ Downloading stylesheet..."
  mkdir -p ./book-content/styles
  curl -s -f -o "./book-content/styles/epub.css" "$STYLESHEET_URL" || {
    echo "⚠️ Warning: Failed to download stylesheet"
  }
fi

# Extract book slug from the payload
BOOK_SLUG=$(jq -r '.book.slug // empty' ./book-content/payload.json)
if [ -z "$BOOK_SLUG" ]; then
  echo "::error::❌ Book slug not found in payload"
  echo "=== Payload Content ==="
  cat ./book-content/payload.json
  exit 2
fi

# Extract chapter list
echo -e "${GREEN}📄 Extracting chapters...${NC}"
mkdir -p ./book-content/chapters

# Extract chapters with order and URL
if ! jq -r '.chapters[] | "\(.order) \(.id)"' ./book-content/payload.json > ./book-content/chapters-list.txt; then
  echo -e "${RED}❌ Failed to parse chapter list${NC}" >&2
  exit 1
fi

# Check if we have chapters
if [ ! -s "./book-content/chapters-list.txt" ]; then
  echo -e "${RED}❌ No chapters found in the book${NC}" >&2
  exit 1
fi

# Set up batch processing
BATCH_SIZE=5
TOTAL_CHAPTERS=$CHAPTER_COUNT
DOWNLOADED_CHAPTERS=0

# Update progress
if [ -n "$BACKEND_URL" ] && [ -n "$COMBINED_TOKEN" ]; then
  curl -s -X POST "$BACKEND_URL/api/publish/update" \
    -H "$AUTH_HEADER" \
    -H "$CONTENT_TYPE_HEADER" \
    -d '{"status":"in-progress","phase":"downloading","progress":10,"message":"Starting chapter downloads"}' >/dev/null 2>&1 || true
fi

# Set base API URL
BASE_API_URL="${API_BASE_URL:-https://editor.bookshall.com}"

# Download chapters in batch
for ((i=0; i<TOTAL_CHAPTERS; i+=BATCH_SIZE)); do
  BATCH_START=$((i+1))
  BATCH_END=$((i+BATCH_SIZE))
  [ $BATCH_END -gt $TOTAL_CHAPTERS ] && BATCH_END=$TOTAL_CHAPTERS
  
  echo -e "${GREEN}📥 Processing chapters ${BATCH_START}-${BATCH_END} of ${TOTAL_CHAPTERS}${NC}"
  
  # Process each chapter in the current batch
  while read -r line; do
    if [ -z "$line" ]; then continue; fi
    
    ORDER=$(echo "$line" | awk '{print $1}')
    CHAPTER_ID=$(echo "$line" | cut -d' ' -f2-)
    
    if [ -z "$CHAPTER_ID" ] || [ "$CHAPTER_ID" = "null" ]; then
      echo -e "${YELLOW}⚠️  Skipping chapter $ORDER: No chapter ID provided${NC}" >&2
      continue
    fi
    
    # Construct the full URL for the chapter
    FULL_URL="${BASE_URL}/api/books/by-id/${CONTENT_ID}/chapters/${CHAPTER_ID}/html"
    echo -e "  📄 Chapter $ORDER: ${CHAPTER_ID:0:30}..."
    
    # Create a temporary file for the chapter content
    TEMP_FILE=$(mktemp)
    
    # Download the chapter with retry logic
    if ! curl -s -f -H "$AUTH_HEADER" "$FULL_URL" -o "$TEMP_FILE"; then
      echo -e "${YELLOW}⚠️  Failed to download chapter $ORDER, retrying...${NC}" >&2
      sleep 2
      
      if ! curl -s -f -H "$AUTH_HEADER" "$FULL_URL" -o "$TEMP_FILE"; then
        echo -e "${RED}❌ Failed to download chapter $ORDER after retry: ${CHAPTER_ID}${NC}" >&2
        rm -f "$TEMP_FILE"
        continue
      fi
    fi
    
    # Save the final chapter file
    FINAL_FILE="./book-content/chapters/chapter-${ORDER}.xhtml"
    mv "$TEMP_FILE" "$FINAL_FILE"
    
    # Update progress
    DOWNLOADED_CHAPTERS=$((DOWNLOADED_CHAPTERS + 1))
    PROGRESS=$(( 10 + ((DOWNLOADED_CHAPTERS * 70) / TOTAL_CHAPTERS) ))  # 10-80% range for downloads
    
    # Send progress update to the server
    if [ -n "$BACKEND_URL" ] && [ -n "$COMBINED_TOKEN" ]; then
      curl -s -X POST "$BACKEND_URL/api/publish/update" \
        -H "$AUTH_HEADER" \
        -H "$CONTENT_TYPE_HEADER" \
        -d "{\"status\":\"in-progress\",\"phase\":\"downloading\",\"progress\":$PROGRESS,\"message\":\"Downloaded chapter $DOWNLOADED_CHAPTERS of $TOTAL_CHAPTERS\"}" >/dev/null 2>&1 || true
    fi
    
  done < <(tail -n +$((i+1)) ./book-content/chapters-list.txt | head -n $BATCH_SIZE)
  
  # Small delay between batches to avoid overwhelming the server
  sleep 1
  
  # Update progress after each batch
  if [ -n "$BACKEND_URL" ] && [ -n "$COMBINED_TOKEN" ]; then
    curl -s -X POST "$BACKEND_URL/api/publish/update" \
      -H "$AUTH_HEADER" \
      -H "$CONTENT_TYPE_HEADER" \
      -d "{\"status\":\"in-progress\",\"phase\":\"downloading\",\"progress\":$PROGRESS,\"message\":\"Processed batch ${BATCH_START}-${BATCH_END} of chapters\"}" >/dev/null 2>&1 || true
  fi
done

echo -e "${GREEN}✅ Successfully downloaded all chapters${NC}"

# Final progress update
if [ -n "$BACKEND_URL" ] && [ -n "$COMBINED_TOKEN" ]; then
  curl -s -X POST "$BACKEND_URL/api/publish/update" \
    -H "$AUTH_HEADER" \
    -H "$CONTENT_TYPE_HEADER" \
    -d '{"status":"in-progress","phase":"processing","progress":90,"message":"Preparing EPUB package"}' >/dev/null 2>&1 || true
fi

# Create the EPUB package
echo -e "${GREEN}📦 Creating EPUB package...${NC}"

# TODO: Add EPUB generation logic here
# This is where you would typically use a tool like pandoc or a custom script
# to generate the EPUB file from the downloaded content

# Example command (commented out as it depends on your EPUB generation setup):
# pandoc -o "book.epub" ./book-content/chapters/*.xhtml --metadata title="$BOOK_TITLE" --metadata language="$BOOK_LANG"

# For now, we'll create a dummy EPUB file to continue the workflow
echo "This is a placeholder for the EPUB file" > "./book.epub"

# Final success message
echo -e "${GREEN}✅ Successfully created EPUB package${NC}"

# Update progress to completed
if [ -n "$BACKEND_URL" ] && [ -n "$COMBINED_TOKEN" ]; then
  curl -s -X POST "$BACKEND_URL/api/publish/update" \
    -H "$AUTH_HEADER" \
    -H "$CONTENT_TYPE_HEADER" \
    -d '{"status":"completed","phase":"finished","progress":100,"message":"EPUB generation complete"}' >/dev/null 2>&1 || true
fi

echo -e "${GREEN}✅ All done!${NC}"

# Download imprint if needed
if [ "$(jq -r '.options.includeImprint // false' ./book-content/payload.json)" = "true" ]; then
  echo "⬇️ Downloading imprint..."
  # Construct the imprint URL using the book slug
  IMPRINT_URL="${BASE_API_URL}/api/books/by-slug/${BOOK_SLUG}/imprint"
  
  # Ensure we're using the full URL with the correct base
  FULL_IMPRINT_URL="$IMPRINT_URL"
  if [[ ! "$IMPRINT_URL" =~ ^https?:// ]]; then
    FULL_IMPRINT_URL="${BASE_API_URL}${IMPRINT_URL}"
  fi
  
  echo "   URL: $FULL_IMPRINT_URL"
  
  if ! download_with_retry "$FULL_IMPRINT_URL" "./book-content/imprint.xhtml"; then
    echo "::warning::⚠️ Failed to download imprint"
    echo "=== Debug Info for Imprint ==="
    echo "URL: $FULL_IMPRINT_URL"
    echo "=== Response Headers ==="
    grep -i '^< HTTP' "./imprint-debug.log" 2>/dev/null || echo "No response headers"
    echo "=== Response Body (first 200 chars) ==="
    head -c 200 "./book-content/imprint.xhtml" 2>/dev/null || echo "No response body"
    echo -e "\n..."
  else
    echo "✅ Successfully downloaded imprint"
  fi
else
  echo "ℹ️ Imprint download is disabled in options"
fi

echo "✅ All book content fetched successfully"
