#!/bin/bash
# Script to convert ebooks to both EPUB and MOBI formats using Calibre's ebook-convert
# Supports PDF, EPUB, and MOBI as input formats
#
# Usage: ./ebookconvert.sh [OPTIONS]
# Options:
#   -i, --input FILE      Input ebook file (PDF/EPUB/MOBI)
#   -t, --title TITLE     Set the book title
#   -a, --author AUTHOR   Set the author name
#   -y, --yes            Skip confirmation prompts (auto-approve)
#   -h, --help           Show this help message

# --- Configuration ---
INPUT_FILE=""
BOOK_TITLE=""
AUTHOR=""
AUTO_APPROVE=false

# --- Parse Command Line Arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_FILE="$2"
            shift 2
            ;;
        -t|--title)
            BOOK_TITLE="$2"
            shift 2
            ;;
        -a|--author)
            AUTHOR="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Convert ebooks to EPUB and MOBI formats"
            echo ""
            echo "Options:"
            echo "  -i, --input FILE      Input ebook file (PDF/EPUB/MOBI)"
            echo "  -t, --title TITLE     Set the book title"
            echo "  -a, --author AUTHOR   Set the author name"
            echo "  -y, --yes            Skip confirmation prompts (auto-approve)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -i \"book.pdf\" -t \"Foundation\" -a \"Isaac Asimov\" -y"
            echo "  $0 --input \"book.mobi\" --title \"My Book\" --author \"John Doe\""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# --- Sanity Checks ---
if [ -z "$INPUT_FILE" ]; then
    echo "Error: No input file specified. Use -i or --input to provide an ebook file."
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file does not exist: $INPUT_FILE"
    exit 1
fi

# Ensure ebook-convert is installed
if ! command -v ebook-convert &> /dev/null; then
    echo "Error: ebook-convert command not found. Please install Calibre:"
    echo "  Fedora: dnf install calibre"
    echo "  Ubuntu: apt install calibre"
    exit 1
fi

# --- Extract input file information ---
INPUT_BASENAME=$(basename "$INPUT_FILE")
INPUT_DIR=$(dirname "$INPUT_FILE")
INPUT_EXT="${INPUT_BASENAME##*.}"
INPUT_NAME="${INPUT_BASENAME%.*}"

# Validate input format
case "${INPUT_EXT,,}" in
    pdf|epub|mobi)
        ;;
    *)
        echo "Error: Unsupported input format: $INPUT_EXT"
        echo "Supported formats: PDF, EPUB, MOBI"
        exit 1
        ;;
esac

# --- Auto-detection of metadata if not provided ---
if [ -z "$BOOK_TITLE" ] || [ -z "$AUTHOR" ]; then
    # Clean the filename (remove extension, underscores to spaces, trim)
    CLEANED_NAME=$(echo "$INPUT_NAME" | sed -E 's/[_]+/ /g; s/(^\s+|\s+$)//g')

    # Try "Title - By Author" pattern
    if [[ "$CLEANED_NAME" == *"- By "* ]]; then
        if [ -z "$AUTHOR" ]; then
            AUTHOR=$(echo "$CLEANED_NAME" | sed -E 's/.* - By //; s/(^\s+|\s+$)//g')
        fi
        if [ -z "$BOOK_TITLE" ]; then
            BOOK_TITLE=$(echo "$CLEANED_NAME" | sed -E 's/ - By .*//; s/(^\s+|\s+$)//g')
        fi
    # Try "Title by Author" pattern
    elif [[ "$CLEANED_NAME" == *" by "* ]]; then
        TEMP_AUTHOR=$(echo "$CLEANED_NAME" | sed -E 's/.* by //; s/(^\s+|\s+$)//g')
        if [[ "$CLEANED_NAME" == *" by $TEMP_AUTHOR" ]]; then
            if [ -z "$AUTHOR" ]; then
                AUTHOR="$TEMP_AUTHOR"
            fi
            if [ -z "$BOOK_TITLE" ]; then
                BOOK_TITLE=$(echo "$CLEANED_NAME" | sed -E "s/ by ${TEMP_AUTHOR}$//; s/(^\s+|\s+$)//g")
            fi
        else
            if [ -z "$BOOK_TITLE" ]; then
                BOOK_TITLE="$CLEANED_NAME"
            fi
        fi
    else
        if [ -z "$BOOK_TITLE" ]; then
            BOOK_TITLE="$CLEANED_NAME"
        fi
    fi
fi

# --- Interactive prompts for missing information (only if not auto-approved) ---
if [ "$AUTO_APPROVE" = false ]; then
    if [ -z "$BOOK_TITLE" ]; then
        echo "Could not automatically determine Book Title."
        read -p "Enter Book Title: " BOOK_TITLE_INPUT
        BOOK_TITLE=${BOOK_TITLE_INPUT:-"Untitled"}
    fi

    if [ -z "$AUTHOR" ]; then
        echo "Could not automatically determine Author for '$BOOK_TITLE'."
        read -p "Enter Author name (or press Enter for 'Unknown Author'): " AUTHOR_INPUT
        AUTHOR=${AUTHOR_INPUT:-"Unknown Author"}
    fi
else
    # Auto-approve mode: use defaults if still empty
    if [ -z "$BOOK_TITLE" ]; then
        BOOK_TITLE="$INPUT_NAME"
    fi
    if [ -z "$AUTHOR" ]; then
        AUTHOR="Unknown Author"
    fi
fi

# --- Determine output files ---
# Clean title for filename (remove invalid characters)
CLEAN_TITLE=$(echo "$BOOK_TITLE" | sed 's/[<>:"/\\|?*]/-/g')
OUTPUT_EPUB="${INPUT_DIR}/${CLEAN_TITLE}.epub"
OUTPUT_MOBI="${INPUT_DIR}/${CLEAN_TITLE}.mobi"

echo "--------------------------------------------------"
echo "Ebook Converter"
echo "--------------------------------------------------"
echo "Input file: $INPUT_BASENAME"
echo "Input format: ${INPUT_EXT^^}"
echo "Book Title: $BOOK_TITLE"
echo "Author: $AUTHOR"
echo "Output EPUB: $(basename "$OUTPUT_EPUB")"
echo "Output MOBI: $(basename "$OUTPUT_MOBI")"
echo "Auto-approve mode: $AUTO_APPROVE"
echo "--------------------------------------------------"

# Ask for confirmation unless auto-approved
if [ "$AUTO_APPROVE" = false ]; then
    read -p "Proceed with conversion? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Conversion cancelled."
        exit 1
    fi
fi

# --- Convert to EPUB ---
if [ "${INPUT_EXT,,}" != "epub" ] || [ ! -f "$OUTPUT_EPUB" ]; then
    echo ""
    echo "Converting to EPUB..."

    # Build ebook-convert command with metadata
    ebook-convert "$INPUT_FILE" "$OUTPUT_EPUB" \
        --title "$BOOK_TITLE" \
        --authors "$AUTHOR" \
        --book-producer "Discord Bot Ebook Converter" \
        --no-default-epub-cover \
        --pretty-print

    epub_exit_code=$?

    if [ $epub_exit_code -eq 0 ]; then
        echo "✓ EPUB conversion successful: $(basename "$OUTPUT_EPUB")"
    else
        echo "✗ EPUB conversion failed with exit code: $epub_exit_code"
        exit $epub_exit_code
    fi
else
    echo "✓ Input is already EPUB, using source file"
    OUTPUT_EPUB="$INPUT_FILE"
fi

# --- Convert to MOBI ---
if [ "${INPUT_EXT,,}" != "mobi" ] || [ ! -f "$OUTPUT_MOBI" ]; then
    echo ""
    echo "Converting to MOBI..."

    # For MOBI, prefer converting from EPUB if we just created one (better quality)
    if [ "${INPUT_EXT,,}" != "epub" ] && [ -f "$OUTPUT_EPUB" ] && [ "$OUTPUT_EPUB" != "$INPUT_FILE" ]; then
        MOBI_SOURCE="$OUTPUT_EPUB"
        echo "Using newly created EPUB as source for MOBI conversion..."
    else
        MOBI_SOURCE="$INPUT_FILE"
    fi

    # Build ebook-convert command with metadata
    ebook-convert "$MOBI_SOURCE" "$OUTPUT_MOBI" \
        --title "$BOOK_TITLE" \
        --authors "$AUTHOR" \
        --book-producer "Discord Bot Ebook Converter"

    mobi_exit_code=$?

    if [ $mobi_exit_code -eq 0 ]; then
        echo "✓ MOBI conversion successful: $(basename "$OUTPUT_MOBI")"
    else
        echo "✗ MOBI conversion failed with exit code: $mobi_exit_code"
        exit $mobi_exit_code
    fi
else
    echo "✓ Input is already MOBI, using source file"
    OUTPUT_MOBI="$INPUT_FILE"
fi

# --- Summary ---
echo ""
echo "--------------------------------------------------"
echo "Conversion Complete!"
echo "--------------------------------------------------"
echo "Output files created:"
if [ -f "$OUTPUT_EPUB" ]; then
    EPUB_SIZE=$(du -h "$OUTPUT_EPUB" | cut -f1)
    echo "  EPUB: $(basename "$OUTPUT_EPUB") ($EPUB_SIZE)"
fi
if [ -f "$OUTPUT_MOBI" ]; then
    MOBI_SIZE=$(du -h "$OUTPUT_MOBI" | cut -f1)
    echo "  MOBI: $(basename "$OUTPUT_MOBI") ($MOBI_SIZE)"
fi
echo "--------------------------------------------------"
echo "Script finished."
