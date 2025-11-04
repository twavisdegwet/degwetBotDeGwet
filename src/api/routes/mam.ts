import express, { Request, Response } from 'express';
import { MamClient } from '../clients/mamClient';
import DelugeClientManager from '../clients/delugeClientManager';
import { z } from 'zod';

const router = express.Router();

// Define Zod schemas for request validation
const SearchRequestSchema = z.object({
  text: z.string().min(1),
  srchIn: z.array(z.string()).optional(),
  searchType: z.enum(['all', 'active', 'inactive', 'fl', 'fl-VIP', 'VIP', 'nVIP', 'nMeta']).optional(),
  searchIn: z.string().optional(),
  cat: z.array(z.string()).optional(),
  sortType: z.enum([
    'titleAsc', 'titleDesc', 'fileAsc', 'fileDesc', 'sizeAsc', 'sizeDesc',
    'seedersAsc', 'seedersDesc', 'leechersAsc', 'leechersDesc', 'snatchedAsc',
    'snatchedDesc', 'dateAsc', 'dateDesc', 'bmkaAsc', 'bmkaDesc', 'reseedAsc',
    'reseedDesc', 'categoryAsc', 'categoryDesc', 'random', 'default'
  ]).optional(),
  startNumber: z.number().int().optional(),
  perpage: z.number().int().min(5).max(100).optional(),
  filetype: z.string().optional(),
  browseFlagsHideVsShow: z.number().int().optional(),
  minSize: z.number().int().optional(),
  maxSize: z.number().int().optional(),
  unit: z.number().int().optional(),
  minSeeders: z.number().int().optional(),
  maxSeeders: z.number().int().optional(),
  minLeechers: z.number().int().optional(),
  maxLeechers: z.number().int().optional(),
  minSnatched: z.number().int().optional(),
  maxSnatched: z.number().int().optional()
});

const DownloadRequestSchema = z.object({
  id: z.string().optional(),
  dlHash: z.string().optional(),
  download_location: z.string().optional()
});

const FreeleechRequestSchema = z.object({
  id: z.number(),
  wedges: z.number().min(1).max(10).optional().default(1)
});

const DuplicateCheckRequestSchema = z.object({
  torrentId: z.number()
});

// Helper function to format torrent results
const formatTorrentResults = (data: any[], mamClient: MamClient) => {
  return data.map(torrent => {
    const formatted = mamClient.formatTorrentForDisplay(torrent);
    return {
      id: formatted.id,
      title: formatted.title,
      size: formatted.size,
      seeders: formatted.seeders,
      leechers: formatted.leechers,
      category: formatted.category,
      catname: torrent.catname,
      completions: formatted.completions,
      isFree: formatted.isFree,
      isVip: formatted.isVip,
      filetype: torrent.filetype,
      author: formatted.author,
      narrator: formatted.narrator,
      series: formatted.series,
      tags: torrent.tags,
      numfiles: torrent.numfiles
    };
  });
};

// Main search endpoint - used by Discord bot /getbook command
router.post('/search', async (req: Request, res: Response) => {
  try {
    const validatedRequest = SearchRequestSchema.parse(req.body);
    const { MAM_BASE_URL, MAM_ID } = process.env;
    
    if (!MAM_ID) {
      return res.status(500).json({ error: 'MAM_ID is not configured' });
    }
    
    const mamClient = new MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
    
    const searchParams = {
      text: validatedRequest.text,
      srchIn: validatedRequest.srchIn || ['title', 'author'],
      searchType: validatedRequest.searchType || 'all',
      searchIn: validatedRequest.searchIn || 'torrents',
      cat: validatedRequest.cat || ['0'],
      sortType: validatedRequest.sortType || 'default',
      startNumber: validatedRequest.startNumber || 0,
      perpage: validatedRequest.perpage || 25,
      filetype: validatedRequest.filetype,
      browseFlagsHideVsShow: validatedRequest.browseFlagsHideVsShow,
      minSize: validatedRequest.minSize,
      maxSize: validatedRequest.maxSize,
      unit: validatedRequest.unit,
      minSeeders: validatedRequest.minSeeders,
      maxSeeders: validatedRequest.maxSeeders,
      minLeechers: validatedRequest.minLeechers,
      maxLeechers: validatedRequest.maxLeechers,
      minSnatched: validatedRequest.minSnatched,
      maxSnatched: validatedRequest.maxSnatched
    };
    
    const response = await mamClient.searchTorrents(searchParams);
    const formattedResults = formatTorrentResults(response.data, mamClient);
    
    return res.json({
      results: formattedResults,
      total: response.total,
      found: response.found,
      query: validatedRequest.text,
      message: `Found ${response.found} torrents`
    });
  } catch (error) {
    console.error('Error in search endpoint:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    return res.status(500).json({ error: 'Failed to search torrents' });
  }
});

// Download endpoint - used by Discord bot
router.post('/download', async (req: Request, res: Response) => {
  try {
    const validatedRequest = DownloadRequestSchema.parse(req.body);
    const { DELUGE_URL, DELUGE_PASSWORD, MAM_BASE_URL, MAM_ID } = process.env;
    
    if (!DELUGE_URL || !DELUGE_PASSWORD) {
      return res.status(500).json({ error: 'Deluge configuration is missing' });
    }
    
    if (!MAM_ID) {
      return res.status(500).json({ error: 'MAM_ID is not configured' });
    }
    
    const delugeManager = DelugeClientManager.getInstance();
    delugeManager.initialize(DELUGE_URL, DELUGE_PASSWORD);
    const delugeClient = await delugeManager.getClient();
    const mamClient = new MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
    
    // Get download URL
    let downloadUrl: string;
    let torrentName: string | undefined;
    
    if (validatedRequest.dlHash) {
      downloadUrl = `${MAM_BASE_URL}/tor/download.php/${validatedRequest.dlHash}`;
    } else if (validatedRequest.id) {
      try {
        downloadUrl = await mamClient.getTorrentDownloadUrl(Number(validatedRequest.id));
        const torrentDetails = await mamClient.getTorrentDetails(validatedRequest.id.toString());
        torrentName = torrentDetails.title;
      } catch (error) {
        downloadUrl = `${MAM_BASE_URL}/tor/download.php?tid=${validatedRequest.id}`;
      }
    } else {
      return res.status(400).json({ error: 'Either id or dlHash must be provided' });
    }
    
    // Always try to set as freeleech before downloading
    if (validatedRequest.id) {
      const torrentId = Number(validatedRequest.id);
      try {
        // Always attempt to set as freeleech, regardless of current state
        const result = await mamClient.setFreeleech(torrentId);
        if (result.success) {
          console.log(`✅ Set torrent ${torrentId} as freeleech (forced)`);
        } else {
          console.log(`⚠️ Could not set freeleech: ${result.error}`);
        }
      } catch (error) {
        console.log(`⚠️ Could not set freeleech: ${error}`);
      }
    }
    
    // Download the torrent
    const mamCookie = `mam_id=${MAM_ID}`;
    let torrentId: string;
    
    try {
      torrentId = await delugeClient.downloadTorrentFromUrl(downloadUrl, mamCookie, torrentName);
    } catch (error: any) {
      // Check if this is a "Torrent already exists in Deluge" error (from delugeClient)
      if ((error instanceof Error && error.message.includes('Torrent already exists in Deluge')) || 
          (error.code === 'DUPLICATE_TORRENT')) {
        console.log(`Full error object:`, error);
        console.log(`Error keys:`, Object.keys(error));
        console.log(`Error.hash:`, (error as any).hash);
        console.log(`Error.code:`, (error as any).code);
        
        const duplicateHash = (error as any).hash;
        console.log(`Duplicate torrent detected: ${duplicateHash || 'unknown hash'}`);

        let existingTorrent = null;

        // If we have the hash, use direct lookup (much faster than getting all torrents)
        if (duplicateHash) {
          console.log(`Looking for torrent with hash: ${duplicateHash}`);
          const torrentStatus = await delugeClient.getTorrentStatus(duplicateHash);
          if (torrentStatus.id) {
            existingTorrent = {
              id: torrentStatus.id,
              name: torrentStatus.name,
              state: torrentStatus.state,
              progress: torrentStatus.progress
            };
            console.log(`Found by hash: ${existingTorrent.name}`);
          }
        }

        // Fallback: If no hash or not found by hash, search by name
        if (!existingTorrent && torrentName) {
          console.log(`Hash lookup failed, falling back to name search`);
          console.log(`Looking for torrent with name containing: ${torrentName}`);
          const existingTorrents = await delugeClient.getTorrents();
          console.log(`Total torrents in Deluge: ${existingTorrents.length}`);
          existingTorrent = existingTorrents.find((t: any) =>
            t.name && t.name.toLowerCase().includes(torrentName.toLowerCase().substring(0, 20))
          );
          console.log(`Found by name: ${existingTorrent ? existingTorrent.name : 'not found'}`);
        }
        
        console.log(`Final existingTorrent: ${existingTorrent ? JSON.stringify({
          id: existingTorrent.id,
          name: existingTorrent.name,
          state: existingTorrent.state,
          progress: existingTorrent.progress
        }) : 'null'}`);
        
        if (existingTorrent) {
          return res.json({
            isDuplicate: true,
            isDuplicateError: false,
            torrentId: existingTorrent.id,
            torrentInfo: {
              name: existingTorrent.name,
              state: existingTorrent.state,
              progress: existingTorrent.progress || 0
            },
            canUploadToGDrive: existingTorrent.state === 'Seeding' || (existingTorrent.progress && existingTorrent.progress >= 100),
            message: `Torrent already exists in Deluge. ${existingTorrent.state === 'Seeding' || (existingTorrent.progress && existingTorrent.progress >= 100) ? 'Ready for Google Drive upload.' : 'Still downloading.'}`
          });
        } else {
          // Still return a proper response instead of error to let bot handle it
          return res.json({
            isDuplicate: true,
            isDuplicateError: true,
            torrentId: (error as any).hash || null,
            torrentInfo: null,
            canUploadToGDrive: false,
            message: 'Torrent already exists in Deluge but could not be found',
            error: 'Torrent already exists in Deluge but could not be found'
          });
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
    
    // If we reach this point, the torrent was successfully added (no duplicate error thrown)
    // Use direct lookup by ID instead of getting all torrents (much faster)
    const torrentStatus = await delugeClient.getTorrentStatus(torrentId);

    // Check if torrent was actually found in Deluge (not dummy data)
    const torrentFoundInDeluge = torrentStatus.state !== 'Not Found' && torrentStatus.name !== 'Torrent not found';

    return res.json({
      torrentId,
      isDuplicate: false, // Successfully added, not a duplicate
      isDuplicateError: false,
      torrentInfo: {
        // Use torrentName from MAM as fallback if Deluge doesn't have it indexed yet
        name: torrentFoundInDeluge ? torrentStatus.name : (torrentName || 'Unknown'),
        state: torrentFoundInDeluge ? torrentStatus.state : 'Downloading',
        progress: torrentFoundInDeluge ? (torrentStatus.progress || 0) : 0
      },
      canUploadToGDrive: false, // Newly added torrents are not ready for upload yet
      message: 'Torrent added successfully to Deluge'
    });
  } catch (error) {
    console.error('Error in download endpoint:', error);
    return res.status(500).json({ error: 'Failed to download and add torrent' });
  }
});

// Freeleech endpoint - used by Discord bot
router.post('/freeleech', async (req: Request, res: Response) => {
  try {
    const validatedRequest = FreeleechRequestSchema.parse(req.body);
    const { MAM_BASE_URL, MAM_ID } = process.env;
    
    if (!MAM_ID) {
      return res.status(500).json({ error: 'MAM_ID is not configured' });
    }
    
    const mamClient = new MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
    const result = await mamClient.setFreeleech(validatedRequest.id);
    
    if (result.success) {
      return res.json({
        success: true,
        message: `Torrent ${validatedRequest.id} set as freeleech`
      });
    } else {
      return res.status(500).json({
        error: 'Failed to set torrent as freeleech',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Error in freeleech endpoint:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    return res.status(500).json({ error: 'Failed to set freeleech' });
  }
});

// Check duplicate endpoint - used by Discord bot
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const validatedRequest = DuplicateCheckRequestSchema.parse(req.body);
    const { DELUGE_URL, DELUGE_PASSWORD, MAM_BASE_URL, MAM_ID } = process.env;
    
    if (!DELUGE_URL || !DELUGE_PASSWORD) {
      return res.status(500).json({ error: 'Deluge configuration is missing' });
    }
    
    if (!MAM_ID) {
      return res.status(500).json({ error: 'MAM_ID is not configured' });
    }
    
    const delugeManager = DelugeClientManager.getInstance();
    delugeManager.initialize(DELUGE_URL, DELUGE_PASSWORD);
    const delugeClient = await delugeManager.getClient();
    const mamClient = new MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
    
    // Get torrent details from MAM
    let torrentName: string | undefined;
    try {
      const torrentDetails = await mamClient.getTorrentDetails(validatedRequest.torrentId.toString());
      torrentName = torrentDetails.title;
    } catch (error) {
      console.log('Could not fetch torrent details for duplicate checking:', error);
    }
    
    // Check for duplicates
    const existingTorrents = await delugeClient.getTorrents();
    let duplicateTorrent = null;
    if (torrentName) {
      duplicateTorrent = existingTorrents.find((t: any) => 
        t.name && t.name.toLowerCase().includes(torrentName.toLowerCase().substring(0, 20))
      );
    }
    
    if (duplicateTorrent) {
      return res.json({
        isDuplicate: true,
        existingTorrent: {
          id: duplicateTorrent.id,
          name: duplicateTorrent.name,
          state: duplicateTorrent.state,
          progress: Math.round((duplicateTorrent.progress || 0) * 100) / 100
        },
        message: 'Torrent already exists in Deluge'
      });
    } else {
      return res.json({
        isDuplicate: false,
        message: 'Torrent not found in Deluge'
      });
    }
  } catch (error) {
    console.error('Error in duplicate check endpoint:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    return res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

// Test connection endpoint - for debugging
router.get('/test-connection', async (_req: Request, res: Response) => {
  try {
    const { MAM_BASE_URL, MAM_ID } = process.env;
    
    if (!MAM_ID) {
      return res.status(500).json({ error: 'MAM_ID is not configured' });
    }
    
    const mamClient = new MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
    
    try {
      const testResults = await mamClient.searchTorrents({
        text: 'test',
        perpage: 1
      });
      
      return res.json({
        success: true,
        message: 'MAM connection successful',
        found: testResults.found,
        mam_id_format: MAM_ID.substring(0, 20) + '...'
      });
    } catch (searchError) {
      return res.status(500).json({
        success: false,
        error: 'MAM search failed',
        details: searchError instanceof Error ? searchError.message : 'Unknown error',
        mam_id_format: MAM_ID.substring(0, 20) + '...'
      });
    }
  } catch (error) {
    console.error('Error testing MAM connection:', error);
    return res.status(500).json({ error: 'Failed to test MAM connection' });
  }
});

// Help endpoint - shows only the endpoints that are actually used
router.get('/help', async (_req: Request, res: Response) => {
  try {
    const helpText = `
📚 Discord Book Bot API Documentation

This API supports the Discord bot's /getbook command functionality.

Available Endpoints:

POST /api/mam/search
- Main search endpoint used by Discord bot /getbook command
- Body: { "text": "search term", "cat": ["14"], "perpage": 25, "filetype": "mp3" }
- Supports all MAM search parameters including category and format filtering

POST /api/mam/download
- Download a torrent using MAM authentication
- Body: { "id": "torrent_id" }
- Automatically handles freeleech setting and duplicate checking

POST /api/mam/freeleech
- Set a torrent as freeleech using personal wedges
- Body: { "id": 12345 }
- Used automatically by the Discord bot for VIP torrents

POST /api/mam/check-duplicate
- Check if a torrent already exists in Deluge
- Body: { "torrentId": 12345 }
- Used automatically by the Discord bot before downloading

GET /api/mam/list-downloads
- List all downloaded audiobooks/ebooks in the configured downloads directory
- No parameters required

GET /api/mam/test-connection
- Test MAM connection and authentication
- No parameters required

GET /api/mam/help
- This help documentation

Discord Bot Commands:
- /getbook - Search and download books (uses /search, /freeleech, /check-duplicate, /download)
- /help - Show Discord bot help

Note: All POST endpoints require JSON body parameters.
Server runs on port 3000 by default.
    `;
    
    return res.json({
      help: helpText.trim(),
      endpoints: [
        'POST /api/mam/search',
        'POST /api/mam/download',
        'POST /api/mam/freeleech',
        'POST /api/mam/check-duplicate',
        'GET /api/mam/test-connection',
        'GET /api/mam/help'
      ],
      discordCommands: [
        '/getbook - Search and download books',
        '/help - Show Discord bot help'
      ]
    });
  } catch (error) {
    console.error('Error in help endpoint:', error);
    return res.status(500).json({ error: 'Failed to retrieve help documentation' });
  }
});

export default router;
