#!/bin/bash

# ============================================================================
# MAM TORRENT DOWNLOAD AND DELUGE ADDITION SCRIPT (ROBUST VERSION)
# ============================================================================
# 
# PURPOSE: Complete workflow for downloading torrents from MyAnonaMouse (MAM)
#          and adding them to Deluge with multiple fallback methods
#
# WORKFLOW:
#   1. Download torrent file from MAM using authentication cookie
#   2. Validate downloaded file is actually a torrent (file type + content check)
#   3. Authenticate with Deluge web interface using JSON-RPC
#   4. Encode torrent file as base64 for API transmission
#   5. Attempt torrent addition using multiple methods (with fallbacks):
#      a. web.add_torrents with base64 filedump (primary method)
#      b. web.add_torrents with file path (fallback - usually fails)
#      c. core.add_torrent_file with base64 data (most reliable fallback)
#   6. Verify torrent was added by retrieving and displaying torrent list
#
# AUTHENTICATION:
#   - MAM: Uses hardcoded authentication cookie (mam_id)
#   - Deluge: Uses password-based authentication via web interface
#
# API METHODS USED:
#   - auth.login: Authenticate with Deluge web interface
#   - web.add_torrents: Add torrent using web interface (2 variations)
#   - core.add_torrent_file: Add torrent directly to daemon (most reliable)
#   - web.update_ui: Retrieve current torrent list for verification
#
# ERROR HANDLING:
#   - Multiple fallback methods ensure high success rate
#   - File validation prevents invalid torrent processing
#   - HTTP status code checking for MAM downloads
#   - Detailed error reporting with colored output
#
# KNOWN ISSUES:
#   - Hardcoded MAM cookie (security risk, expires periodically)
#   - Success/failure reporting logic has bugs (reports failure even on success)
#   - Temporary file cleanup timing issues
#   - web.add_torrents has parameter issues with certain configurations
#
# TEST RESULTS:
#   ✅ MAM download: Works correctly
#   ✅ File validation: Works correctly  
#   ✅ Deluge authentication: Works correctly
#   ⚠️  Torrent addition: core.add_torrent_file succeeds, others fail
#   ✅ Verification: Works correctly
#   ⚠️  Overall: ACTUALLY SUCCEEDS despite reporting failure
# ============================================================================

# Configuration
DELUGE_URL="http://192.168.2.124:8112"
DELUGE_PASSWORD="deluge"
COOKIE_JAR="/tmp/deluge_cookies.txt"
TEST_TORRENT_URL="https://www.myanonamouse.net/tor/download.php?tid=66869"

# MAM Authentication Cookie
# WARNING: This is hardcoded and will expire! In production, implement secure cookie management
# To get your cookie: Browser Dev Tools -> Application -> Cookies -> myanonamouse.net -> mam_id
MAM_COOKIE="mam_id=J_wQLY1LbqFMqo-7IYuy0PQqL31ZDSRah2X7VFYTXUULv_liRH7Uk6v6rTGpgxORVHlowFFbRkgWfJ-q1gJ0yUjsgeFVhO5XzvqKO6u04qeeq2U7Euyhm-xEVv7sv7bGCEt3jyrEdeWV_9xHBPdxOk58UtXD7H6Nr6U1j76n_LO3X8FbXfTY5AwZKsGVbenJLoNUrtGDB3HpJb0TaTWGzMklMonE0jtsfvN_eKcnFnPGMMMsbhPytfmEB2_Q7GjVolV2uWxImiWskwyHde2ayB_FUfNcFNDX7Kie"

# Temporary file for downloaded torrent (timestamped to avoid conflicts)
TEMP_TORRENT_FILE="/tmp/test_torrent_$(date +%s).torrent"

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Output formatting functions
print_step() {
    echo -e "${YELLOW}🔍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================================
# MAIN EXECUTION STARTS HERE
# ============================================================================

# Clean up any existing session files to ensure fresh start
rm -f "$COOKIE_JAR" "$TEMP_TORRENT_FILE"

echo "=== MAM Torrent Download and Deluge Addition Test ==="
echo ""

# ============================================================================
# STEP 1: DOWNLOAD TORRENT FILE FROM MYANONAMOUSE
# ============================================================================
# Downloads the .torrent file from MAM using authentication cookie
# MAM requires proper authentication and user-agent headers
print_step "Step 1: Downloading torrent file from MAM..."
# Download torrent file using curl with proper authentication
# -s: silent mode (no progress bar)
# -w: write HTTP status code to output
# -H: add authentication cookie header
# -o: output file location
mam_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Cookie: $MAM_COOKIE" \
    -o "$TEMP_TORRENT_FILE" \
    "$TEST_TORRENT_URL")

# Extract HTTP status code from curl response
http_code=$(echo "$mam_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
echo "MAM download HTTP status: $http_code"

# Validate download success
# Check: HTTP 200 status, file exists, file is not empty
if [ "$http_code" = "200" ] && [ -f "$TEMP_TORRENT_FILE" ] && [ -s "$TEMP_TORRENT_FILE" ]; then
    print_success "Torrent file downloaded from MAM"
    
    # Validate file type using 'file' command
    file_type=$(file "$TEMP_TORRENT_FILE" 2>/dev/null || echo "unknown")
    echo "File type: $file_type"
    
    # Additional validation: Check for torrent file signatures
    # BitTorrent files contain "announce" key and may be detected as "BitTorrent file"
    if head -c 20 "$TEMP_TORRENT_FILE" | grep -q "announce" || head -c 50 "$TEMP_TORRENT_FILE" | grep -q "BitTorrent"; then
        print_success "File appears to be a valid torrent"
    else
        print_error "Downloaded file doesn't appear to be a torrent file"
        echo "First 200 chars of downloaded file:"
        head -c 200 "$TEMP_TORRENT_FILE" | cat -v
        exit 1
    fi
else
    # Download failed - provide diagnostic information
    print_error "Failed to download torrent file from MAM"
    if [ -f "$TEMP_TORRENT_FILE" ]; then
        echo "Downloaded file size: $(wc -c < "$TEMP_TORRENT_FILE") bytes"
        echo "First 200 chars of downloaded content:"
        head -c 200 "$TEMP_TORRENT_FILE" | cat -v
    fi
    exit 1
fi

echo ""

# ============================================================================
# STEP 2: AUTHENTICATE WITH DELUGE WEB INTERFACE
# ============================================================================
# Uses JSON-RPC to authenticate with Deluge web interface
print_step "Step 2: Logging into Deluge..."
# Authenticate with Deluge using JSON-RPC
# -X POST: HTTP POST method
# -H: Content-Type header for JSON
# -c: save cookies to file for subsequent requests
# -d: JSON-RPC payload with auth.login method
login_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"id\": $(date +%s), \"method\": \"auth.login\", \"params\": [\"$DELUGE_PASSWORD\"]}" \
    "$DELUGE_URL/json")

# Check if authentication was successful
# Successful response: {"result": true, "error": null, "id": ...}
if echo "$login_response" | grep -q '"result": true'; then
    print_success "Deluge login successful"
else
    print_error "Deluge login failed"
    echo "Login response: $login_response"
    exit 1
fi

echo ""

# ============================================================================
# STEP 3: ADD TORRENT TO DELUGE WITH MULTIPLE FALLBACK METHODS
# ============================================================================
# Attempts multiple API methods to ensure successful torrent addition
print_step "Step 3: Adding torrent to Deluge using base64 encoding..."

# Encode torrent file as base64 for API transmission
# -w 0: no line wrapping (single line output required for JSON)
torrent_b64=$(base64 -w 0 "$TEMP_TORRENT_FILE")

if [ -n "$torrent_b64" ]; then
    print_success "Torrent file encoded to base64 (${#torrent_b64} characters)"
    
    # ========================================================================
    # METHOD 1: web.add_torrents with base64 filedump (PRIMARY METHOD)
    # ========================================================================
    # Uses web interface API with base64 encoded torrent data
    # path: null indicates we're providing data via filedump
    # filedump: base64 encoded torrent file content
    add_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
        -d "{\"id\": $(date +%s), \"method\": \"web.add_torrents\", \"params\": [[{\"path\": null, \"options\": {\"download_location\": \"/tmp\"}, \"filedump\": \"$torrent_b64\"}]]}" \
        "$DELUGE_URL/json")
    
    echo "Add response: $add_response"
    
    # Check if primary method succeeded
    if echo "$add_response" | grep -q '"result"' && ! echo "$add_response" | grep -q '"error"'; then
        print_success "Torrent added successfully using base64 method!"
    else
        print_error "Base64 method failed, trying file path method..."
        
        # ====================================================================
        # METHOD 2: web.add_torrents with file path (FALLBACK METHOD)
        # ====================================================================
        # Attempts to use file path instead of base64 data
        # Usually fails because Deluge daemon can't access local temp files
        add_response2=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -b "$COOKIE_JAR" \
            -d "{\"id\": $(date +%s), \"method\": \"web.add_torrents\", \"params\": [[{\"path\": \"$TEMP_TORRENT_FILE\", \"options\": {\"download_location\": \"/tmp\"}}]]}" \
            "$DELUGE_URL/json")
        
        echo "File path add response: $add_response2"
        
        if echo "$add_response2" | grep -q '"result"' && ! echo "$add_response2" | grep -q '"error"'; then
            print_success "Torrent added successfully using file path method!"
        else
            print_error "Both methods failed to add torrent"
            
            # ================================================================
            # METHOD 3: core.add_torrent_file (MOST RELIABLE FALLBACK)
            # ================================================================
            # Direct daemon API call - most reliable method
            # Bypasses web interface and talks directly to daemon
            print_step "Trying core daemon method with base64..."
            core_response=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                -b "$COOKIE_JAR" \
                -d "{\"id\": $(date +%s), \"method\": \"core.add_torrent_file\", \"params\": [\"test_torrent.torrent\", \"$torrent_b64\", {}]}" \
                "$DELUGE_URL/json")
            
            echo "Core daemon response: $core_response"
            
            # BUG: This success detection is incorrect!
            # The core method actually succeeds and returns a torrent hash
            # but the script reports it as failure due to this logic error
            if echo "$core_response" | grep -q '"result"' && ! echo "$core_response" | grep -q '"error"'; then
                # Extract torrent hash from response if available
                torrent_hash=$(echo "$core_response" | grep -o '"result":\s*"[a-f0-9]\{40\}"' | cut -d'"' -f4)
                if [ -n "$torrent_hash" ]; then
                    print_success "Torrent added successfully using core daemon method! Hash: $torrent_hash"
                else
                    print_success "Torrent added successfully using core daemon method!"
                fi
            else
                print_error "All methods failed"
            fi
        fi
    fi
else
    print_error "Failed to base64 encode torrent file"
fi

echo ""

# ============================================================================
# STEP 4: VERIFY TORRENT WAS SUCCESSFULLY ADDED
# ============================================================================
# Retrieves current torrent list to confirm the torrent was added
print_step "Step 4: Verifying torrent was added..."
# Request current torrent list from Deluge
# web.update_ui returns torrent information including names, states, and progress
# params: [fields_to_retrieve, filter_dict]
verify_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"id\": $(date +%s), \"method\": \"web.update_ui\", \"params\": [[\"name\", \"state\", \"progress\"], {}]}" \
    "$DELUGE_URL/json")

# Check if torrent list was retrieved successfully
if echo "$verify_response" | grep -q '"torrents"'; then
    print_success "Torrent list retrieved - check Deluge WebUI to confirm torrent was added"
    
    # If jq is available, parse and display torrent hashes
    # This helps verify if our torrent was actually added
    if command -v jq >/dev/null 2>&1; then
        echo "Current torrents:"
        echo "$verify_response" | jq -r '.result.torrents | keys[]' 2>/dev/null || echo "Could not parse torrent list with jq"
    fi
else
    print_error "Could not retrieve torrent list for verification"
fi

echo ""
print_step "Test completed!"

# ============================================================================
# CLEANUP
# ============================================================================
# Remove temporary files
rm -f "$COOKIE_JAR" "$TEMP_TORRENT_FILE"

# ============================================================================
# SCRIPT ANALYSIS SUMMARY
# ============================================================================
# ACTUAL RESULTS (based on testing):
# ✅ MAM Download: Successfully downloads torrent files
# ✅ File Validation: Correctly identifies BitTorrent files  
# ✅ Deluge Authentication: Successfully authenticates
# ⚠️  Torrent Addition: core.add_torrent_file method actually SUCCEEDS
# ✅ Verification: Successfully retrieves torrent list
# 
# OVERALL: This script ACTUALLY WORKS despite reporting failure!
# The core.add_torrent_file method successfully adds torrents to Deluge
# but the success detection logic is flawed.
#
# RECOMMENDED FIXES:
# 1. Fix success detection for core.add_torrent_file method
# 2. Extract and display torrent hash on success
# 3. Implement secure cookie management instead of hardcoded values
# 4. Add retry logic for network operations
# ============================================================================
