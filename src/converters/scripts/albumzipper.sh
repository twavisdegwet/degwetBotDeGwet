#!/bin/bash
# Script to zip music album folders and maintain an albums inventory
#
# Usage: ./albumzipper.sh [OPTIONS]
# Options:
#   -d, --directory DIR     Music directory to scan (default: /mnt/nas/Movies/musicTheMovie/)
#   -a, --albums-dir DIR    Albums directory for zip files (default: <music-dir>/albums/)
#   -l, --list-only         Only create albums.txt, don't zip anything
#   -f, --force             Re-zip albums even if zip files already exist
#   -h, --help              Show this help message

# --- Configuration ---
MUSIC_DIR="/mnt/nas/Movies/musicTheMovie/"
ALBUMS_DIR=""
LIST_ONLY=false
FORCE_REZIP=false

# --- Color codes for terminal output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Output formatting functions ---
print_step() {
    echo -e "${BLUE}🔍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# --- Parse Command Line Arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            MUSIC_DIR="$2"
            shift 2
            ;;
        -a|--albums-dir)
            ALBUMS_DIR="$2"
            shift 2
            ;;
        -l|--list-only)
            LIST_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE_REZIP=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Zip music album folders and maintain albums inventory"
            echo ""
            echo "Options:"
            echo "  -d, --directory DIR     Music directory to scan (default: /mnt/nas/Movies/musicTheMovie/)"
            echo "  -a, --albums-dir DIR    Albums directory for zip files (default: <music-dir>/albums/)"
            echo "  -l, --list-only         Only create albums.txt, don't zip anything"
            echo "  -f, --force             Re-zip albums even if zip files already exist"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Process default directory"
            echo "  $0 -d /path/to/music -l               # Only list albums, don't zip"
            echo "  $0 -f                                 # Force re-zip all albums"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# --- Set default albums directory ---
if [ -z "$ALBUMS_DIR" ]; then
    ALBUMS_DIR="${MUSIC_DIR}albums/"
fi

# --- Sanity Checks ---
print_step "Performing sanity checks..."

# Check if music directory exists
if [ ! -d "$MUSIC_DIR" ]; then
    print_error "Music directory does not exist: $MUSIC_DIR"
    exit 1
fi

print_success "Music directory exists: $MUSIC_DIR"

# Create albums directory if it doesn't exist
if [ ! -d "$ALBUMS_DIR" ]; then
    print_info "Creating albums directory: $ALBUMS_DIR"
    mkdir -p "$ALBUMS_DIR"
    if [ $? -ne 0 ]; then
        print_error "Failed to create albums directory: $ALBUMS_DIR"
        exit 1
    fi
    print_success "Albums directory created"
else
    print_info "Albums directory already exists: $ALBUMS_DIR"
fi

# --- Find all album folders ---
print_step "Scanning for album folders..."

# Find all directories in music folder, excluding the albums directory itself
# Using find with proper null termination to handle special characters
mapfile -d '' album_dirs < <(find "$MUSIC_DIR" -maxdepth 1 -type d -not -path "$MUSIC_DIR" -not -path "${MUSIC_DIR}albums" -not -path "${MUSIC_DIR}albums/" -print0)

if [ ${#album_dirs[@]} -eq 0 ]; then
    print_warning "No album folders found in: $MUSIC_DIR"
    exit 0
fi

print_success "Found ${#album_dirs[@]} album folders"

# --- Create albums.txt file ---
print_step "Creating albums inventory file..."

ALBUMS_LIST_FILE="${MUSIC_DIR}albums.txt"
echo "# Albums inventory - Generated on $(date)" > "$ALBUMS_LIST_FILE"
echo "# Total albums found: ${#album_dirs[@]}" >> "$ALBUMS_LIST_FILE"
echo "" >> "$ALBUMS_LIST_FILE"

for album_dir in "${album_dirs[@]}"; do
    # Get just the folder name (basename)
    album_name=$(basename "$album_dir")
    echo "$album_name" >> "$ALBUMS_LIST_FILE"
done

print_success "Albums list created: $ALBUMS_LIST_FILE"

# Show contents of the list file
echo "Album inventory:"
cat "$ALBUMS_LIST_FILE" | grep -v "^#" | grep -v "^$"
echo ""

# --- Exit if list-only mode ---
if [ "$LIST_ONLY" = true ]; then
    print_info "List-only mode: Skipping zip creation"
    exit 0
fi

# --- Process each album for zipping ---
print_step "Processing albums for zipping..."

albums_processed=0
albums_zipped=0
albums_skipped=0

for album_dir in "${album_dirs[@]}"; do
    album_name=$(basename "$album_dir")
    zip_file="${ALBUMS_DIR}${album_name}.zip"

    ((albums_processed++))

    if [ -f "$zip_file" ] && [ "$FORCE_REZIP" = false ]; then
        print_info "[$albums_processed/${#album_dirs[@]}] Skipping '$album_name' - zip already exists"
        ((albums_skipped++))
        continue
    fi

    print_step "[$albums_processed/${#album_dirs[@]}] Zipping '$album_name'..."

    # Create zip file
    # Using relative paths within the zip for cleaner structure
    cd "$MUSIC_DIR"
    if zip -r -q "$zip_file" "$album_name" 2>/dev/null; then
        # Get zip file size
        zip_size=$(du -h "$zip_file" | cut -f1)
        print_success "Zipped '$album_name' ($zip_size)"
        ((albums_zipped++))
    else
        print_error "Failed to zip '$album_name'"
    fi

    # Return to original directory
    cd - >/dev/null
done

# --- Final Report ---
echo ""
print_step "Processing complete!"
echo "📊 Summary:"
echo "   Albums found: ${#album_dirs[@]}"
echo "   Albums zipped: $albums_zipped"
echo "   Albums skipped: $albums_skipped"
echo "   Albums list: $ALBUMS_LIST_FILE"
echo "   Zip location: $ALBUMS_DIR"

if [ $albums_zipped -gt 0 ]; then
    print_success "Successfully processed $albums_zipped albums"
else
    print_info "No new albums needed zipping"
fi

print_info "Script finished."
