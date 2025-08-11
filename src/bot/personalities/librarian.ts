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

// Enhanced Librarian system prompt
const LIBRARIAN_SYSTEM_PROMPT = `
You are a helpful librarian assistant with access to both local stock and book discovery services. Your job is to:
1. Interpret what format the user wants (ebook, audiobook, or let them choose)
2. Check if we have it in stock first using AI-powered fuzzy matching
3. Show book descriptions and details for local matches
4. If not in stock, route to the appropriate download command
5. Encourage follow-up questions and provide personalized recommendations

BEHAVIOR:
- ALWAYS check local stock first with list_available_stock
- For local stock matches: 
  * Show the book description, release date, and format
  * Provide /gdrive-upload "[exact torrent name]" command
  * Ask if they want similar recommendations
- For new downloads: use /getebook "title by author" or /getaudiobook "title by author"
- When showing multiple results, ask user to specify which one they want
- Be conversational and encourage follow-up questions
- Use book emojis 📚🎧📖

ENHANCED LOCAL SEARCH:
- The system now uses AI to match user queries to available titles
- It can find "Moneyball" even if the torrent is named "Michael Lewis - Moneyball The Art of Winning an Unfair Game Unabridged"
- All local results include Hardcover descriptions and metadata
- Present options clearly and ask for clarification when needed

FORMAT DETECTION:
- Look for keywords like "audiobook", "audio", "listen", "narrated" → audiobook
- Look for keywords like "ebook", "epub", "read", "pdf" → ebook  
- If unclear, suggest both options

FOLLOW-UP ENGAGEMENT:
- After showing results, ask follow-up questions like:
  * "Would you like me to find similar books?"
  * "Any particular author or genre you're in the mood for?"
  * "Should I look for both formats or do you have a preference?"
- Make the conversation natural and helpful!
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

// Helper functions for AI filtering and enhancement
async function aiFilterResults(results: any[], userQuery: string): Promise<any[]> {
  try {
    // Create a summary of all available titles for the AI to analyze
    const titlesSummary = results.map((r, index) => 
      `${index}: "${r.parsed_title}" by ${r.parsed_author} (${r.format})`
    ).join('\n');

    const filterPrompt = `
You are helping match a user's book request to available titles in a library.

User is looking for: "${userQuery}"

Available titles:
${titlesSummary}

Return ONLY the numbers (comma-separated) of titles that match the user's request. Consider:
- Partial title matches
- Author matches  
- Similar/related titles
- Format preferences (audiobook/ebook)

If no good matches, return "none".

Examples:
- User wants "Moneyball" → Look for titles containing "Moneyball" or by Michael Lewis
- User wants "Harry Potter audiobook" → Look for Harry Potter titles in audiobook format
- User wants "Stephen King" → Look for any Stephen King titles

Numbers only:`;

    const aiResponse = await agenticChat('', filterPrompt, [], {});
    
    if (aiResponse.toLowerCase().includes('none')) {
      return [];
    }
    
    // Parse the AI response to get the indices
    const indices = aiResponse.match(/\d+/g)?.map(n => parseInt(n)) || [];
    
    // Return the matched results
    return indices
      .filter(i => i >= 0 && i < results.length)
      .map(i => results[i]);
      
  } catch (error) {
    console.error('AI filtering failed, falling back to simple search:', error);
    // Fallback to original simple search
    const lowerFilter = userQuery.toLowerCase();
    return results.filter(r => 
      r.name.toLowerCase().includes(lowerFilter) ||
      r.parsed_title.toLowerCase().includes(lowerFilter) ||
      r.parsed_author.toLowerCase().includes(lowerFilter)
    );
  }
}

async function enhanceWithDescriptions(results: any[]): Promise<any[]> {
  try {
    const enhancedResults = [];
    
    // Process each result to add Hardcover description
    for (const result of results) {
      const searchQuery = result.parsed_author 
        ? `${result.parsed_title} by ${result.parsed_author}`
        : result.parsed_title;
      
      try {
        const books = await hardcoverClient.searchBooks(searchQuery, 1);
        if (books && books.length > 0) {
          const book = books[0];
          enhancedResults.push({
            ...result,
            description: book.description || 'No description available',
            release_date: book.release_date,
            hardcover_id: book.id,
            enhanced: true
          });
        } else {
          // Keep original result if no Hardcover match
          enhancedResults.push({
            ...result,
            description: 'Description not available',
            enhanced: false
          });
        }
      } catch (bookError) {
        console.error(`Error fetching description for ${searchQuery}:`, bookError);
        enhancedResults.push({
          ...result,
          description: 'Description not available',
          enhanced: false
        });
      }
    }
    
    return enhancedResults;
  } catch (error) {
    console.error('Error enhancing with descriptions:', error);
    // Return original results if enhancement fails
    return results.map(r => ({ ...r, description: 'Description not available', enhanced: false }));
  }
}

// Simplified tool implementations
const toolFunctions = {
  async list_available_stock(args: { filter?: string }): Promise<string> {
    try {
      const clientManager = DelugeClientManager.getInstance();
      const delugeClient = await clientManager.getClient();
      const torrents = await delugeClient.getTorrents();
      let available = torrents.filter(t => t.progress >= 100);
      
      // Enhanced mapping with format detection and title parsing
      const allResults = available.map(t => {
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
      
      if (args.filter) {
        // Use AI to intelligently filter results
        const aiFilteredResults = await aiFilterResults(allResults, args.filter);
        // Enhance results with Hardcover descriptions
        const enhancedResults = await enhanceWithDescriptions(aiFilteredResults.slice(0, 10));
        return JSON.stringify(enhancedResults);
      }
      
      return JSON.stringify(allResults.slice(0, 10));
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