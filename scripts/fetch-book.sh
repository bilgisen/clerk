#!/bin/bash
set -e  # Exit on error

# ANSI color codes for better output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Set default values
BASE_URL=${BASE_URL:-'https://matbu.vercel.app'}

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
REQUIRED_VARS=("CONTENT_ID" "JWT_TOKEN")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    log_error "Missing required environment variable: $var"
    exit 1
  fi
done

# Set JWT_HEADER if not provided
if [ -z "$JWT_HEADER" ] && [ -n "$JWT_TOKEN" ]; then
  JWT_HEADER="Bearer $JWT_TOKEN"
  export JWT_HEADER
fi

# Set BASE_URL if not provided
if [ -z "$BASE_URL" ]; then
  log_warning "BASE_URL not set, using default: $BASE_URL"
fi

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

# Optional JWT inspection (disabled by default). Enable with CURL_VERBOSE=1
if [ "${CURL_VERBOSE}" = "1" ]; then
  log_info "🔑 JWT Token Analysis (limited):"
  {
    echo "Header (alg, kid only):"
    echo "$JWT_TOKEN" | cut -d'.' -f1 | base64 -d 2>/dev/null | jq '{alg, kid}' || echo "Failed to decode JWT header"
    echo "\nPayload (selected claims):"
    echo "$JWT_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '{iss, aud, repository, ref, workflow, iat, exp}' || echo "Failed to decode JWT payload"
  } > ./jwt-debug.json
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
      "-H" "Authorization: Bearer $JWT_TOKEN"
      "-H" "X-Auth-Method: oidc"
      "-H" "X-Auth-Audience: $JWT_AUDIENCE"
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

# Make the request with verbose output and save debug info
set -x
curl -v -s -f -D ./headers.txt -o ./book-content/payload.json \
  -H "Accept: application/json" \
  -H "Authorization: $JWT_HEADER" \
  -H "X-Auth-Method: oidc" \
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
  download_with_retry "$COVER_URL" "./book-content/cover.jpg" || echo "⚠️ Warning: Failed to download cover"
fi

# Download stylesheet
if [ -n "$STYLESHEET_URL" ]; then
  echo "⬇️ Downloading stylesheet..."
  mkdir -p ./book-content/styles
  download_with_retry "$STYLESHEET_URL" "./book-content/styles/epub.css" || echo "⚠️ Warning: Failed to download stylesheet"
fi

# Extract book slug from the payload
BOOK_SLUG=$(jq -r '.book.slug // empty' ./book-content/payload.json)
if [ -z "$BOOK_SLUG" ]; then
  echo "::error::❌ Book slug not found in payload"
  exit 2
fi

# Extract chapter list with IDs
echo "📄 Extracting chapters..."
if ! jq -r '.book.chapters[] | "\(.order) \(.id)"' ./book-content/payload.json > ./book-content/chapters-list.txt; then
  echo "::error::❌ Failed to parse chapter list"
  exit 2
fi

CHAPTER_COUNT=$(wc -l < ./book-content/chapters-list.txt)
echo "✅ Found $CHAPTER_COUNT chapters"

# Set base API URL
BASE_API_URL="${API_BASE_URL:-https://editor.bookshall.com}"

# Download chapters in batch
BATCH_SIZE=5
for ((i=0; i<CHAPTER_COUNT; i+=BATCH_SIZE)); do
  echo "📥 Processing chapters $((i+1))-$((i+BATCH_SIZE))"
  tail -n +$((i+1)) ./book-content/chapters-list.txt | head -n $BATCH_SIZE | while read -r ORDER URL; do
    echo "🔸 Downloading chapter $ORDER..."
    # Construct the chapter URL using the book slug and chapter ID
    FULL_URL="${BASE_API_URL}/api/books/by-slug/${BOOK_SLUG}/chapters/${URL}/html"
    
    # Add debug output
    echo "   Chapter ID: $URL"
    echo "   URL: $FULL_URL"
    
    # Create chapters directory if it doesn't exist
    mkdir -p "./book-content/chapters"
    
    if ! download_with_retry "$FULL_URL" "./book-content/chapters/chapter-${ORDER}.xhtml"; then
      
      echo "::warning::⚠️ Failed to download chapter $ORDER"
      echo "=== Debug Info for Chapter $ORDER ==="
      echo "URL: $FULL_URL"
      echo "=== Response Headers ==="
      grep -i '^< HTTP' "./chapter-${ORDER}-debug.log" || echo "No response headers"
      echo "=== Response Body (first 200 chars) ==="
      head -c 200 "./book-content/chapters/chapter-${ORDER}.xhtml" 2>/dev/null || echo "No response body"
      echo -e "\n..."
    fi
  done
  sleep 1
done

# Download imprint if needed
if [ "$(jq -r '.options.include_imprint // false' ./book-content/payload.json)" = "true" ]; then
  echo "⬇️ Downloading imprint..."
  # Construct the imprint URL using the book slug
  IMPRINT_URL="${BASE_API_URL}/api/books/by-slug/${BOOK_SLUG}/imprint"
  echo "   Imprint URL: $IMPRINT_URL"
  
  if ! download_with_retry "$IMPRINT_URL" "./book-content/imprint.xhtml"; then
    echo "::warning::⚠️ Failed to download imprint"
  else
    echo "✅ Successfully downloaded imprint"
  fi
fi
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
      grep -i '^< HTTP' "./imprint-debug.log" || echo "No response headers"
      echo "=== Response Body (first 200 chars) ==="
      head -c 200 "./book-content/imprint.xhtml" 2>/dev/null || echo "No response body"
      echo -e "\n..."
    else
      echo "✅ Successfully downloaded imprint"
    fi
  else
    echo "ℹ️ No imprint URL found in payload"
  fi
else
  echo "ℹ️ Imprint download is disabled in options"
fi

echo "✅ All book content fetched successfully"
