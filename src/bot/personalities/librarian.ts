import { HardcoverClient } from '../../api/clients/hardcoverClient';
import { MamClient } from '../../api/clients/mamClient';
import { DelugeClient } from '../../api/clients/delugeClient';
import { env } from '../../config/env';
import { agenticChat, OllamaTool } from '../agenticutils';

// Initialize clients
const hardcoverClient = new HardcoverClient();
const mamClient = new MamClient(env.MAM_BASE_URL, env.MAM_COOKIE);
const delugeClient = new DelugeClient(env.DELUGE_URL, env.DELUGE_PASSWORD);

// Librarian system prompt
const LIBRARIAN_SYSTEM_PROMPT = `
You are a knowledgeable and passionate librarian. You help users with book recommendations, descriptions, and checking availability in our stock.

CRITICAL BEHAVIOR: 
- ALWAYS check list_available_stock FIRST for any book request, even if it seems like a simple title search
- The stock search now includes format detection (audiobook/ebook/unknown) to help you provide the right command
- If a user's request is vague, ambiguous, or lacks specific details, use the ask_clarification tool ONLY if absolutely necessary
- Try to be helpful with partial information rather than always asking for clarification
- Examples of requests that might need clarification:
  * "I want a good book" (but try to suggest popular titles first)
  * "Something about magic" (suggest popular fantasy titles)

SEARCH PRIORITY:
1. ALWAYS check list_available_stock first for matches in our local collection
   - The results include format detection (audiobook/ebook/unknown)
   - Match titles flexibly (partial matches are okay)
   - If found, provide the exact Discord command based on detected format
2. If nothing in local stock, use search_books from Hardcover for recommendations
3. Only use search_mam if user specifically requests a book not in our stock

RESPONSE FORMAT:
- For books in local stock: Provide ONLY the exact Discord command to upload from local collection:
  * "/gdrive-upload \"Title\"" (use the exact torrent name for best matching)
  * Mention the detected format (audiobook/ebook) for user information
- For books NOT in local stock: Use /getaudiobook or /getebook commands to download new books
- For clarification: Use ask_clarification tool
- Always be friendly and use emojis 📚✨
- Respond in natural language, not JSON or tool syntax

IMPORTANT: Local stock = already downloaded = use /gdrive-upload. Not in stock = need to download = use /getaudiobook or /getebook.
`;

// Define tools
const tools: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'ask_clarification',
      description: 'Ask the user for clarification when their request is vague or needs more specific information.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The clarifying question to ask the user' },
          suggestions: { 
            type: 'string', 
            description: 'Optional comma-separated list of suggestions or examples to help the user'
          }
        },
        required: ['question']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_available_stock',
      description: 'List available books in our local download stock (Deluge).',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Filter by title or author' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_books',
      description: 'Search Hardcover for book recommendations or descriptions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g., genre, author, topic)' },
          limit: { type: 'number', description: 'Number of results (default 5)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_book_details',
      description: 'Get detailed information about a specific book by ID from Hardcover.',
      parameters: {
        type: 'object',
        properties: {
          book_id: { type: 'number', description: 'The ID of the book' }
        },
        required: ['book_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_mam',
      description: 'Search MyAnonaMouse for book torrents and availability.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Book title' },
          author: { type: 'string', description: 'Book author' },
          format: { 
            type: 'string', 
            description: 'Format: ebook, audiobook, or any',
            enum: ['ebook', 'audiobook', 'any']
          }
        },
        required: ['title']
      }
    }
  }
];

// Tool implementations
const toolFunctions = {
  async ask_clarification(args: { question: string; suggestions?: string }): Promise<string> {
    // This tool is used to ask clarifying questions - it returns the question to be asked
    let response = args.question;
    if (args.suggestions) {
      response += `\n\nSome options to consider: ${args.suggestions}`;
    }
    return `CLARIFICATION_NEEDED: ${response}`;
  },

  async list_available_stock(args: { filter?: string }): Promise<string> {
    const torrents = await delugeClient.getTorrents();
    let available = torrents.filter(t => t.progress >= 100);
    
    if (args.filter) {
      const lowerFilter = args.filter.toLowerCase();
      available = available.filter(t => t.name.toLowerCase().includes(lowerFilter));
    }
    
    // Enhanced mapping with format detection
    const enhancedResults = available.map(t => {
      const name = t.name;
      const lowerName = name.toLowerCase();
      
      // Detect format based on filename patterns
      let detectedFormat = 'unknown';
      if (lowerName.includes('audiobook') || lowerName.includes('unabr') || 
          lowerName.includes('abridged') || lowerName.includes('narrated') ||
          lowerName.includes('mp3') || lowerName.includes('m4b') ||
          lowerName.includes('audio')) {
        detectedFormat = 'audiobook';
      } else if (lowerName.includes('ebook') || lowerName.includes('epub') || 
                 lowerName.includes('pdf') || lowerName.includes('mobi') ||
                 lowerName.includes('azw') || lowerName.includes('kindle')) {
        detectedFormat = 'ebook';
      }
      
      return {
        name: name,
        state: t.state,
        progress: t.progress,
        format: detectedFormat
      };
    });
    
    return JSON.stringify(enhancedResults);
  },

  async search_books(args: { query: string; limit?: number }): Promise<string> {
    const limit = args.limit || 5;
    const books = await hardcoverClient.searchBooks(args.query, limit);
    return JSON.stringify(books.map(book => ({
      id: book.id,
      title: book.title,
      description: book.description,
      release_date: book.release_date
    })));
  },

  async get_book_details(args: { book_id: number }): Promise<string> {
    const book = await hardcoverClient.getBookById(args.book_id);
    if (!book) return 'Book not found';
    return JSON.stringify({
      id: book.id,
      title: book.title,
      description: book.description,
      release_date: book.release_date
    });
  },

  async search_mam(args: { title: string; author?: string; format?: 'ebook' | 'audiobook' | 'any' }): Promise<string> {
    const format = args.format || 'any';
    const results = await searchMAMForBook(args.title, args.author || '', format);
    const bestCopy = selectBestCopy(results);
    return JSON.stringify({
      results_count: results.length,
      best_copy: bestCopy ? {
        id: bestCopy.id,
        seeders: bestCopy.seeders,
        size: bestCopy.size,
        is_free: bestCopy.freeleech || false,
        is_vip: bestCopy.vip || false
      } : null
    });
  }
};

// Original MAM search function (reused)
async function searchMAMForBook(title: string, author: string = '', format: 'ebook' | 'audiobook' | 'any' = 'any'): Promise<any[]> {
  try {
    const searchQuery = `${title} ${author}`.trim();
    
    let categories: string[] = [];
    if (format === 'ebook') {
      categories = [
        '60', '71', '72', '90', '61', '73', '101', '62', '63', '107', '64', '74', 
        '102', '76', '77', '65', '103', '115', '91', '66', '78', '67', '79', '80', 
        '92', '118', '94', '120', '95', '81', '82', '68', '69', '75', '96', '104', 
        '109', '70', '112'
      ];
    } else if (format === 'audiobook') {
      categories = [
        '39', '49', '50', '83', '51', '97', '40', '41', '106', '42', '52', '98', 
        '54', '55', '43', '99', '84', '44', '56', '45', '57', '85', '87', '119', 
        '88', '58', '59', '46', '47', '53', '89', '100', '108', '48', '111'
      ];
    } else {
      categories = [
        '60', '71', '72', '90', '61', '73', '101', '62', '63', '107', '64', '74', 
        '102', '76', '77', '65', '103', '115', '91', '66', '78', '67', '79', '80', 
        '92', '118', '94', '120', '95', '81', '82', '68', '69', '75', '96', '104', 
        '109', '70', '112', '39', '49', '50', '83', '51', '97', '40', '41', '106', 
        '42', '52', '98', '54', '55', '43', '99', '84', '44', '56', '45', '57', 
        '85', '87', '119', '88', '58', '59', '46', '47', '53', '89', '100', '108', 
        '48', '111'
      ];
    }

    const searchParams = {
      text: searchQuery,
      srchIn: ['title', 'author'],
      cat: categories,
      sortType: 'seedersDesc' as const,
      perpage: 20
    };

    const results = await mamClient.searchTorrents(searchParams);
    return results.data || [];
  } catch (error) {
    console.error('Error searching MAM for book:', error);
    return [];
  }
}

// Original selectBestCopy function (reused)
function selectBestCopy(torrents: any[]): any | null {
  if (!torrents || torrents.length === 0) {
    return null;
  }

  const sortedTorrents = [...torrents].sort((a, b) => {
    const aIsFree = mamClient.isTorrentFree(a);
    const bIsFree = mamClient.isTorrentFree(b);
    
    if (aIsFree && !bIsFree) return -1;
    if (!aIsFree && bIsFree) return 1;
    
    if (a.seeders !== b.seeders) {
      return b.seeders - a.seeders;
    }
    
    if (a.times_completed !== b.times_completed) {
      return b.times_completed - a.times_completed;
    }
    
    return 0;
  });

  return sortedTorrents[0];
}

/**
 * Main function to get librarian response using agentic chat
 */
export async function getLibrarianResponse(query: string, format: 'ebook' | 'audiobook' | 'any' = 'any', limit: number = 5): Promise<string> {
  // Incorporate format and limit into the query, but only if they're not 'any' or default
  let contextualQuery = query;
  if (format !== 'any') {
    contextualQuery += `. User prefers ${format} format.`;
  }
  if (limit !== 5) {
    contextualQuery += ` User wants up to ${limit} recommendations.`;
  }
  
  try {
    const response = await agenticChat(
      LIBRARIAN_SYSTEM_PROMPT,
      contextualQuery,
      tools,
      toolFunctions
    );
    
    // Handle clarification responses
    if (response.includes('CLARIFICATION_NEEDED:')) {
      const clarificationText = response.replace('CLARIFICATION_NEEDED:', '').trim();
      return `📚 ${clarificationText}`;
    }
    
    return response;
  } catch (error) {
    console.error('Error in getLibrarianResponse:', error);
    return 'Sorry, the librarian is unavailable right now. Please try again later. 📚';
  }
}
