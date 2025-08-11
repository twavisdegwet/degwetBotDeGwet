import { HardcoverClient } from '../../api/clients/hardcoverClient';
import DelugeClientManager from '../../api/clients/delugeClientManager';
import { agenticChat, OllamaTool } from '../agenticutils';

// Initialize clients
const hardcoverClient = new HardcoverClient();

// Parse title and author from torrent name
function parseTorrentTitle(torrentName: string): { title: string; author: string; cleanTitle: string } {
  let name = torrentName;
  
  // Remove common file extensions
  name = name.replace(/\.(mp3|m4a|m4b|aac|flac|epub|pdf|mobi|azw|azw3)$/i, '');
  
  // Remove common torrent suffixes
  name = name.replace(/[-_\s]*(unabridged|audiobook|ebook|retail|kindle|epub|pdf|mp3|m4b)[-_\s]*/gi, ' ');
  name = name.replace(/[-_\s]*\d{4}[-_\s]*$/g, ''); // Remove year at end
  name = name.replace(/[-_\s]*\[.*?\][-_\s]*/g, ' '); // Remove bracketed content
  name = name.replace(/[-_\s]*\(.*?\)[-_\s]*/g, ' '); // Remove parenthetical content
  name = name.replace(/[-_\s]*HC[-_\s]*$/gi, ''); // Remove HC suffix
  
  // Clean up multiple spaces and trim
  name = name.replace(/\s+/g, ' ').trim();
  
  let title = '';
  let author = '';
  
  // Try to parse Author-Title format
  const authorTitleMatch = name.match(/^([^-]+?)\s*-\s*(.+)$/);
  if (authorTitleMatch) {
    author = authorTitleMatch[1].trim();
    title = authorTitleMatch[2].trim();
  } else {
    // If no clear author-title separation, treat whole thing as title
    title = name;
  }
  
  // Create a clean searchable title
  const cleanTitle = title.replace(/^(The|A|An)\s+/i, '').toLowerCase();
  
  return {
    title: title,
    author: author,
    cleanTitle: cleanTitle
  };
}

// Simplified Librarian system prompt
const LIBRARIAN_SYSTEM_PROMPT = `
You are a helpful librarian assistant. Your job is to:
1. Interpret what format the user wants (ebook, audiobook, or let them choose)
2. Check if we have it in stock first
3. If not in stock, route to the appropriate download command
4. Optionally provide book descriptions and suggestions

BEHAVIOR:
- ALWAYS check local stock first with list_available_stock
- For local stock: provide /gdrive-upload "[exact torrent name]" command
- For new downloads: use /getebook "title by author" or /getaudiobook "title by author"
- Be concise and helpful
- Use book emojis 📚🎧📖

FORMAT DETECTION:
- Look for keywords like "audiobook", "audio", "listen", "narrated" → audiobook
- Look for keywords like "ebook", "epub", "read", "pdf" → ebook  
- If unclear, suggest both options

KEEP IT SIMPLE - don't over-complicate the response!
`;

// Simplified tool set
const tools: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_available_stock',
      description: 'Check what books are available in our local stock (Deluge).',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Search by title, author, or keywords' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_book_description',
      description: 'Get book description and details from Hardcover.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Book title or title and author' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_similar_books',
      description: 'Find similar book recommendations.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Book, author, or genre to find similar books for' },
          limit: { type: 'number', description: 'Number of suggestions (default 3)' }
        },
        required: ['query']
      }
    }
  }
];

// Simplified tool implementations
const toolFunctions = {
  async list_available_stock(args: { filter?: string }): Promise<string> {
    try {
      const clientManager = DelugeClientManager.getInstance();
      const delugeClient = await clientManager.getClient();
      const torrents = await delugeClient.getTorrents();
      let available = torrents.filter(t => t.progress >= 100);
      
      if (args.filter) {
        const lowerFilter = args.filter.toLowerCase();
        available = available.filter(t => t.name.toLowerCase().includes(lowerFilter));
      }
      
      // Enhanced mapping with format detection and title parsing
      const results = available.slice(0, 10).map(t => {
        const name = t.name;
        const lowerName = name.toLowerCase();
        
        // Detect format
        let format = 'unknown';
        if (lowerName.includes('audiobook') || lowerName.includes('unabridged') || 
            lowerName.includes('mp3') || lowerName.includes('m4b') || lowerName.includes('audio')) {
          format = 'audiobook';
        } else if (lowerName.includes('ebook') || lowerName.includes('epub') || 
                   lowerName.includes('pdf') || lowerName.includes('mobi')) {
          format = 'ebook';
        }
        
        // Parse title and author
        const parsed = parseTorrentTitle(name);
        
        return {
          name: name,
          format: format,
          parsed_title: parsed.title,
          parsed_author: parsed.author
        };
      });
      
      return JSON.stringify(results);
    } catch (error) {
      return 'Error checking local stock';
    }
  },

  async get_book_description(args: { query: string }): Promise<string> {
    try {
      const books = await hardcoverClient.searchBooks(args.query, 1);
      if (books && books.length > 0) {
        const book = books[0];
        return JSON.stringify({
          title: book.title,
          description: book.description || 'No description available',
          release_date: book.release_date,
          id: book.id
        });
      }
      return 'Book not found in Hardcover database';
    } catch (error) {
      return 'Error fetching book description';
    }
  },

  async suggest_similar_books(args: { query: string; limit?: number }): Promise<string> {
    try {
      const limit = args.limit || 3;
      const books = await hardcoverClient.searchBooks(args.query, limit + 2); // Get a few extra to filter
      
      if (books && books.length > 0) {
        const suggestions = books.slice(0, limit).map(book => ({
          title: book.title,
          description: book.description ? book.description.substring(0, 200) + '...' : 'No description',
          id: book.id
        }));
        return JSON.stringify(suggestions);
      }
      return 'No similar books found';
    } catch (error) {
      return 'Error finding similar books';
    }
  }
};

// Helper function to extract format preference from query
function detectFormatPreference(query: string): 'ebook' | 'audiobook' | 'any' {
  const lowerQuery = query.toLowerCase();
  
  const audiobookKeywords = ['audiobook', 'audio book', 'listen', 'narrated', 'audio', 'mp3', 'm4b'];
  const ebookKeywords = ['ebook', 'e-book', 'read', 'pdf', 'epub', 'kindle', 'mobi'];
  
  const hasAudioKeywords = audiobookKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasEbookKeywords = ebookKeywords.some(keyword => lowerQuery.includes(keyword));
  
  if (hasAudioKeywords && !hasEbookKeywords) return 'audiobook';
  if (hasEbookKeywords && !hasAudioKeywords) return 'ebook';
  return 'any';
}


/**
 * Simplified librarian response function
 */
export async function getLibrarianResponse(query: string, format: 'ebook' | 'audiobook' | 'any' = 'any'): Promise<string> {
  // Auto-detect format if not specified
  if (format === 'any') {
    format = detectFormatPreference(query);
  }
  
  let contextualQuery = query;
  if (format !== 'any') {
    contextualQuery += `. User prefers ${format} format.`;
  }
  
  try {
    const response = await agenticChat(
      LIBRARIAN_SYSTEM_PROMPT,
      contextualQuery,
      tools,
      toolFunctions
    );
    
    return response;
  } catch (error) {
    console.error('Error in getLibrarianResponse:', error);
    return '📚 The librarian is taking a coffee break. Please try again in a moment!';
  }
}