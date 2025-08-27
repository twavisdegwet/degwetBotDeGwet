#!/bin/bash
# Script to convert all .mp3 files in a folder structure to a single chapterized M4B.
# Files are found recursively and sorted by disc number then track number.
# 
# Usage: ./mp3tom4b.sh [OPTIONS]
# Options:
#   -t, --title TITLE     Set the book title
#   -a, --author AUTHOR   Set the author name
#   -o, --output OUTPUT   Set the output filename (without extension)
#   -y, --yes            Skip confirmation prompts (auto-approve)
#   -h, --help           Show this help message

# --- Configuration ---
CURRENT_DIR_NAME=$(basename "$PWD")
BOOK_TITLE=""
AUTHOR=""
OUTPUT_FILENAME=""
AUTO_APPROVE=false

# --- Parse Command Line Arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--title)
            BOOK_TITLE="$2"
            shift 2
            ;;
        -a|--author)
            AUTHOR="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILENAME="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Convert MP3 files to M4B audiobook format"
            echo ""
            echo "Options:"
            echo "  -t, --title TITLE     Set the book title"
            echo "  -a, --author AUTHOR   Set the author name"
            echo "  -o, --output OUTPUT   Set the output filename (without extension)"
            echo "  -y, --yes            Skip confirmation prompts (auto-approve)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -t \"Quicksilver\" -a \"Dean Koontz\" -y"
            echo "  $0 --title \"My Book\" --author \"John Doe\" --output \"my-audiobook\""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# --- Auto-detection if not provided via command line ---
if [ -z "$BOOK_TITLE" ] || [ -z "$AUTHOR" ]; then
    # Attempt to derive Book Title and Author from the current directory name
    # First, clean the directory name a bit (remove common audiobook suffixes, underscores to spaces, trim)
    CLEANED_DIR_NAME=$(echo "$CURRENT_DIR_NAME" | sed -E 's/ non-?abridged//I; s/ audiobook//I; s/[_]+/ /g; s/(^\s+|\s+$)//g')

    # Try "Title - By Author" pattern
    if [[ "$CLEANED_DIR_NAME" == *"- By "* ]]; then
        if [ -z "$AUTHOR" ]; then
            AUTHOR=$(echo "$CLEANED_DIR_NAME" | sed -E 's/.* - By //; s/(^\s+|\s+$)//g')
        fi
        if [ -z "$BOOK_TITLE" ]; then
            BOOK_TITLE=$(echo "$CLEANED_DIR_NAME" | sed -E 's/ - By .*//; s/(^\s+|\s+$)//g')
        fi
    # Else, try "Title by Author" pattern (greedy match for author part after the last " by ")
    elif [[ "$CLEANED_DIR_NAME" == *" by "* ]]; then
        TEMP_AUTHOR=$(echo "$CLEANED_DIR_NAME" | sed -E 's/.* by //; s/(^\s+|\s+$)//g')
        # Check if what we extracted is a plausible author part and not the whole title or part of it.
        if [[ "$CLEANED_DIR_NAME" == *" by $TEMP_AUTHOR" ]]; then
            if [ -z "$AUTHOR" ]; then
                AUTHOR="$TEMP_AUTHOR"
            fi
            if [ -z "$BOOK_TITLE" ]; then
                BOOK_TITLE=$(echo "$CLEANED_DIR_NAME" | sed -E "s/ by ${TEMP_AUTHOR}$//; s/(^\s+|\s+$)//g")
            fi
        else # " by " was likely part of the title, so just use the cleaned name as title
            if [ -z "$BOOK_TITLE" ]; then
                BOOK_TITLE="$CLEANED_DIR_NAME"
            fi
        fi
    else # No clear author pattern, use the cleaned directory name as the title
        if [ -z "$BOOK_TITLE" ]; then
            BOOK_TITLE="$CLEANED_DIR_NAME"
        fi
    fi
fi

# --- Interactive prompts for missing information (only if not auto-approved) ---
if [ "$AUTO_APPROVE" = false ]; then
    # Fallbacks and Prompts if auto-detection wasn't satisfactory
    if [ -z "$BOOK_TITLE" ]; then
        echo "Could not automatically determine Book Title."
        read -p "Enter Book Title: " BOOK_TITLE_INPUT
        BOOK_TITLE=${BOOK_TITLE_INPUT:-"Untitled Audiobook"}
    fi

    if [ -z "$AUTHOR" ]; then
        echo "Could not automatically determine Author for '$BOOK_TITLE'."
        read -p "Enter Author name (or press Enter for 'Unknown Author'): " AUTHOR_INPUT
        AUTHOR=${AUTHOR_INPUT:-"Unknown Author"}
    fi
else
    # Auto-approve mode: use defaults if still empty
    if [ -z "$BOOK_TITLE" ]; then
        BOOK_TITLE="$CURRENT_DIR_NAME"
    fi
    if [ -z "$AUTHOR" ]; then
        AUTHOR="Unknown Author"
    fi
fi

# Set output filename
if [ -z "$OUTPUT_FILENAME" ]; then
    OUTPUT_M4B_FILENAME="${BOOK_TITLE}.m4b"
else
    OUTPUT_M4B_FILENAME="${OUTPUT_FILENAME}.m4b"
fi

# Temporary filenames (prefixed to avoid clashes)
METADATA_CHAPTER_FILE="makebook_ffmpeg_metadata_chapters.txt"
FFMPEG_INPUT_LIST_FILE="makebook_ffmpeg_input_files.txt"

# --- Sanity Checks & Setup ---
# Ensure ffmpeg and ffprobe are installed
if ! command -v ffmpeg &> /dev/null || ! command -v ffprobe &> /dev/null; then
    echo "Error: ffmpeg and ffprobe are required but not found. Please install them."
    exit 1
fi

# Clean up previous temporary files if they exist
rm -f "$METADATA_CHAPTER_FILE" "$FFMPEG_INPUT_LIST_FILE"

echo "--------------------------------------------------"
echo "Audiobook Creator (Recursive)"
echo "--------------------------------------------------"
echo "Current directory: $CURRENT_DIR_NAME"
echo "Book Title: $BOOK_TITLE"
echo "Author: $AUTHOR"
echo "Output M4B filename: $OUTPUT_M4B_FILENAME"
echo "Auto-approve mode: $AUTO_APPROVE"
echo "--------------------------------------------------"

# --- Gather and Sort MP3 Files ---
echo "Looking for MP3 files recursively..."

# Find all MP3 files recursively, then sort them properly
# Using find with -print0 to handle special characters properly
mapfile -d '' all_mp3_files < <(find . -type f -name '*.mp3' -print0)

if [ ${#all_mp3_files[@]} -eq 0 ]; then
    echo "No .mp3 files found in the current directory or subdirectories."
    rm -f "$METADATA_CHAPTER_FILE" "$FFMPEG_INPUT_LIST_FILE"
    exit 1
fi

# Sort files naturally (handles numbers properly)
# Remove the ./ prefix from filenames for cleaner display
sorted_mp3_files=()
while IFS= read -r -d '' file; do
    # Remove leading ./ from the path
    clean_path="${file#./}"
    sorted_mp3_files+=("$clean_path")
done < <(printf '%s\0' "${all_mp3_files[@]}" | sort -z -V)

echo "Found ${#sorted_mp3_files[@]} MP3 files to process."

# Show the sorting order for verification
echo "File processing order:"
for i in "${!sorted_mp3_files[@]}"; do
    printf "%3d: %s\n" $((i+1)) "${sorted_mp3_files[$i]}"
done
echo

# Ask user if they want to proceed with this order (unless auto-approved)
if [ "$AUTO_APPROVE" = false ]; then
    read -p "Does this file order look correct? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Exiting. Please reorganize files or modify the script if needed."
        rm -f "$METADATA_CHAPTER_FILE" "$FFMPEG_INPUT_LIST_FILE"
        exit 1
    fi
else
    echo "Auto-approve mode: proceeding with file order shown above."
fi

# --- Create FFmpeg Input File List ---
# This file tells ffmpeg which files to concatenate and in what order.
# CRITICAL: Properly escape filenames for ffmpeg's concat demuxer
echo "ffconcat version 1.0" > "$FFMPEG_INPUT_LIST_FILE"
for mp3_file in "${sorted_mp3_files[@]}"; do
    # Escape single quotes by replacing them with '\''
    # This closes the quote, adds an escaped quote, then opens a new quote
    escaped_filename=$(printf '%s\n' "$mp3_file" | sed "s/'/'\\\\''/g")
    echo "file '$escaped_filename'" >> "$FFMPEG_INPUT_LIST_FILE"
done
echo "FFmpeg input file list created: $FFMPEG_INPUT_LIST_FILE"

# --- Generate Chapter Metadata ---
echo "Generating chapter metadata..."
# Start the metadata file with global M4B tags
echo ";FFMETADATA1" > "$METADATA_CHAPTER_FILE"
# Escape special characters in metadata
escaped_title=$(printf '%s\n' "$BOOK_TITLE" | sed 's/[=\\]/\\&/g')
escaped_author=$(printf '%s\n' "$AUTHOR" | sed 's/[=\\]/\\&/g')
echo "title=$escaped_title" >> "$METADATA_CHAPTER_FILE"
echo "artist=$escaped_author" >> "$METADATA_CHAPTER_FILE"
echo "album_artist=$escaped_author" >> "$METADATA_CHAPTER_FILE"
echo "genre=Audiobook" >> "$METADATA_CHAPTER_FILE"
echo "comment=Converted from MP3s using mp3tom4b.sh on $(date)" >> "$METADATA_CHAPTER_FILE"

# Initialize timing and chapter count for chapter generation
current_total_duration_ms=0
chapter_counter=1

for mp3_file in "${sorted_mp3_files[@]}"; do
    echo "Processing for chapter metadata: $mp3_file"
    
    # Use ffprobe with proper quoting to handle special characters
    file_duration_seconds=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$mp3_file" 2>/dev/null)
    
    if [ -z "$file_duration_seconds" ] || ! [[ "$file_duration_seconds" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        echo "Error: Could not get a valid duration for '$mp3_file'."
        echo "ffprobe output was: '$file_duration_seconds'"
        echo "Please check if the file is a valid MP3 and ffprobe is working correctly."
        rm -f "$METADATA_CHAPTER_FILE" "$FFMPEG_INPUT_LIST_FILE"
        exit 1
    fi
    
    file_duration_ms=$(awk -v dur_sec="$file_duration_seconds" 'BEGIN {printf "%.0f", dur_sec * 1000}')
    start_time_ms=$current_total_duration_ms
    end_time_ms=$(awk -v current_total_ms="$current_total_duration_ms" -v file_dur_ms="$file_duration_ms" 'BEGIN {printf "%.0f", current_total_ms + file_dur_ms}')
    
    # Extract chapter title from filename
    # Remove path and extension, then clean up
    base_filename=$(basename "$mp3_file" .mp3)
    # Try to extract chapter number from common patterns
    if [[ "$base_filename" =~ Chapter[[:space:]]*[-_]*[[:space:]]*([0-9]+) ]]; then
        chapter_num=${BASH_REMATCH[1]}
        current_chapter_title="Chapter $chapter_num"
    elif [[ "$base_filename" =~ ([0-9]+) ]]; then
        chapter_num=${BASH_REMATCH[1]}
        current_chapter_title="Chapter $chapter_num"
    else
        current_chapter_title="Chapter $chapter_counter"
    fi
    
    # Escape special characters in chapter title
    escaped_chapter_title=$(printf '%s\n' "$current_chapter_title" | sed 's/[=\\]/\\&/g')
    
    echo "" >> "$METADATA_CHAPTER_FILE"
    echo "[CHAPTER]" >> "$METADATA_CHAPTER_FILE"
    echo "TIMEBASE=1/1000" >> "$METADATA_CHAPTER_FILE" # Timebase in milliseconds
    echo "START=$start_time_ms" >> "$METADATA_CHAPTER_FILE"
    echo "END=$end_time_ms" >> "$METADATA_CHAPTER_FILE"
    echo "title=$escaped_chapter_title" >> "$METADATA_CHAPTER_FILE"
    
    current_total_duration_ms=$end_time_ms
    chapter_counter=$((chapter_counter + 1))
done
echo "Chapter metadata generated: $METADATA_CHAPTER_FILE"

# --- Execute FFmpeg Conversion ---
echo "Starting M4B conversion. This may take a while..."
echo "Output file will be: $OUTPUT_M4B_FILENAME"

# Get number of CPU cores for parallel processing
NUM_THREADS=$(nproc)
echo "Using $NUM_THREADS threads for encoding..."

# Optimized encoding with m4b-tool techniques for maximum speed
echo "Starting optimized M4B conversion..."
ffmpeg -y -f concat -safe 0 -i "$FFMPEG_INPUT_LIST_FILE" -i "$METADATA_CHAPTER_FILE" \
       -map_metadata 1 -c:a aac -q:a 2 -ar 44100 -ac 2 -vn \
       -threads "$NUM_THREADS" -max_muxing_queue_size 9999 \
       -movflags +faststart -strict experimental \
       "$OUTPUT_M4B_FILENAME"
ffmpeg_exit_code=$?

# --- Finalization ---
if [ $ffmpeg_exit_code -eq 0 ]; then
    echo "--------------------------------------------------"
    echo "Successfully created M4B audiobook: $OUTPUT_M4B_FILENAME"
    echo "Cleaning up temporary files..."
    rm -f "$METADATA_CHAPTER_FILE" "$FFMPEG_INPUT_LIST_FILE"
    echo "Done."
else
    echo "--------------------------------------------------"
    echo "Error during M4B conversion. FFmpeg command failed."
    echo "Temporary files ($METADATA_CHAPTER_FILE, $FFMPEG_INPUT_LIST_FILE) were kept for inspection."
    exit 1
fi

echo "Script finished."
