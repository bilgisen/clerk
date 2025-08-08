#!/bin/bash
set -e  # Exit on error

# ANSI color codes for better output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

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

# Validate JWT token structure
validate_jwt() {
  local token=$1
  local parts
  IFS='.' read -ra parts <<< "$token"
  
  if [ ${#parts[@]} -ne 3 ]; then
    log_error "Invalid JWT token format: expected 3 parts, got ${#parts[@]}"
    return 1
  fi
  
  # Verify header
  if ! echo "${parts[0]}" | base64 -d 2>/dev/null | jq -e '.typ == "JWT"' >/dev/null; then
    log_error "Invalid JWT header"
    return 1
  fi
  
  # Verify payload
  if ! echo "${parts[1]}" | base64 -d 2>/dev/null | jq -e '.exp' >/dev/null; then
    log_error "Invalid JWT payload"
    return 1
  fi
  
  log_info "JWT token structure is valid"
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
REQUIRED_VARS=("CONTENT_ID" "BASE_URL" "JWT_HEADER" "JWT_TOKEN")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    log_error "Missing required environment variable: $var"
    exit 1
  fi
done

# Ensure JWT token is properly formatted
if [[ -z "$JWT_TOKEN" && -n "$JWT_HEADER" ]]; then
  # Extract token from header if it's in Bearer format
  if [[ "$JWT_HEADER" == Bearer* ]]; then
    JWT_TOKEN="${JWT_HEADER#Bearer }"
  else
    JWT_TOKEN="$JWT_HEADER"
  fi
fi

# Validate JWT token
if ! validate_jwt "$JWT_TOKEN"; then
  log_error "JWT token validation failed"
  exit 1
fi

# Ensure we have a valid token
if [ -z "$JWT_TOKEN" ]; then
  log_error "No JWT token provided"
  exit 1
fi

# Create necessary directories
log_info "Creating output directories..."
mkdir -p ./book-content/chapters

# Set the payload URL
PAYLOAD_URL="$BASE_URL/api/books/by-id/$CONTENT_ID/payload"
log_info "🌐 Attempting to fetch payload from: $PAYLOAD_URL"

# Debug: Print the JWT token header and payload
log_info "🔑 JWT Token Analysis:"
{
  echo "Header:"
  echo "$JWT_TOKEN" | cut -d'.' -f1 | base64 -d 2>/dev/null | jq . || echo "Failed to decode JWT header"
  echo "\nPayload:"
  echo "$JWT_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq . || echo "Failed to decode JWT payload"
} | tee ./jwt-debug.json

# Debug: Print environment info

# Make the request with verbose output and save debug info
set -x
curl -v -s -f -D ./headers.txt -o ./book-content/payload.json \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  "$PAYLOAD_URL" 2> ./curl-debug.log || {
    CURL_EXIT_CODE=$?
    set +x
    echo "\n❌ Curl failed with exit code: $CURL_EXIT_CODE"
    echo "\n📝 Response headers:"
    cat ./headers.txt
    
    echo "\n🔍 Curl debug log:"
    cat ./curl-debug.log
    
    # Try to decode the JWT for debugging
    if [ -n "$JWT_TOKEN" ]; then
      echo "\n🔑 JWT Token Analysis:"
      echo "- Token length: ${#JWT_TOKEN} characters"
      
      # Try to decode the JWT payload
      if command -v jq &> /dev/null; then
        echo -n "- Payload: "
        echo "$JWT_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -c '{iss, aud, sub, iat, exp}' || echo "Failed to decode JWT payload"
      fi
    fi
    
    exit 1
}
set +x

echo "\n✅ Received response. Analyzing..."

# Check if the response is a redirect
if grep -q "^HTTP/.* 30[0-9]" ./headers.txt; then
  echo "\n🔄 Detected redirect response:"
  grep "^Location:" ./headers.txt || echo "No Location header found"
  
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
