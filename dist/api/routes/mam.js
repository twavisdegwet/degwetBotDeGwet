"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mamClient_1 = require("../clients/mamClient");
const delugeClientManager_1 = __importDefault(require("../clients/delugeClientManager"));
const zod_1 = require("zod");
const router = express_1.default.Router();
const SearchRequestSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    srchIn: zod_1.z.array(zod_1.z.string()).optional(),
    searchType: zod_1.z.enum(['all', 'active', 'inactive', 'fl', 'fl-VIP', 'VIP', 'nVIP', 'nMeta']).optional(),
    cat: zod_1.z.array(zod_1.z.string()).optional(),
    sortType: zod_1.z.enum([
        'titleAsc', 'titleDesc', 'fileAsc', 'fileDesc', 'sizeAsc', 'sizeDesc',
        'seedersAsc', 'seedersDesc', 'leechersAsc', 'leechersDesc', 'snatchedAsc',
        'snatchedDesc', 'dateAsc', 'dateDesc', 'bmkaAsc', 'bmkaDesc', 'reseedAsc',
        'reseedDesc', 'categoryAsc', 'categoryDesc', 'random', 'default'
    ]).optional(),
    startNumber: zod_1.z.number().int().optional(),
    perpage: zod_1.z.number().int().min(5).max(100).optional(),
    filetype: zod_1.z.string().optional()
});
const DownloadRequestSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    dlHash: zod_1.z.string().optional(),
    download_location: zod_1.z.string().optional()
});
const FreeleechRequestSchema = zod_1.z.object({
    id: zod_1.z.number(),
    wedges: zod_1.z.number().min(1).max(10).optional().default(1)
});
const DuplicateCheckRequestSchema = zod_1.z.object({
    torrentId: zod_1.z.number()
});
const formatTorrentResults = (data, mamClient) => {
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
            tags: torrent.tags
        };
    });
};
router.post('/search', async (req, res) => {
    try {
        const validatedRequest = SearchRequestSchema.parse(req.body);
        const { MAM_BASE_URL, MAM_ID } = process.env;
        if (!MAM_ID) {
            return res.status(500).json({ error: 'MAM_ID is not configured' });
        }
        const mamClient = new mamClient_1.MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
        const searchParams = {
            text: validatedRequest.text,
            srchIn: validatedRequest.srchIn || ['title', 'author'],
            searchType: validatedRequest.searchType || 'all',
            cat: validatedRequest.cat || ['0'],
            sortType: validatedRequest.sortType || 'default',
            startNumber: validatedRequest.startNumber || 0,
            perpage: validatedRequest.perpage || 25,
            filetype: validatedRequest.filetype
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
    }
    catch (error) {
        console.error('Error in search endpoint:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Invalid request parameters',
                details: error.errors
            });
        }
        return res.status(500).json({ error: 'Failed to search torrents' });
    }
});
router.post('/download', async (req, res) => {
    try {
        const validatedRequest = DownloadRequestSchema.parse(req.body);
        const { DELUGE_URL, DELUGE_PASSWORD, MAM_BASE_URL, MAM_ID } = process.env;
        if (!DELUGE_URL || !DELUGE_PASSWORD) {
            return res.status(500).json({ error: 'Deluge configuration is missing' });
        }
        if (!MAM_ID) {
            return res.status(500).json({ error: 'MAM_ID is not configured' });
        }
        const delugeManager = delugeClientManager_1.default.getInstance();
        delugeManager.initialize(DELUGE_URL, DELUGE_PASSWORD);
        const delugeClient = await delugeManager.getClient();
        const mamClient = new mamClient_1.MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
        let downloadUrl;
        let torrentName;
        if (validatedRequest.dlHash) {
            downloadUrl = `${MAM_BASE_URL}/tor/download.php/${validatedRequest.dlHash}`;
        }
        else if (validatedRequest.id) {
            try {
                downloadUrl = await mamClient.getTorrentDownloadUrl(Number(validatedRequest.id));
                const torrentDetails = await mamClient.getTorrentDetails(validatedRequest.id.toString());
                torrentName = torrentDetails.title;
            }
            catch (error) {
                downloadUrl = `${MAM_BASE_URL}/tor/download.php?tid=${validatedRequest.id}`;
            }
        }
        else {
            return res.status(400).json({ error: 'Either id or dlHash must be provided' });
        }
        if (validatedRequest.id) {
            const torrentId = Number(validatedRequest.id);
            try {
                const torrentDetails = await mamClient.getTorrentDetails(torrentId.toString());
                if (!mamClient.isTorrentFree(torrentDetails)) {
                    await mamClient.setFreeleech(torrentId);
                    console.log(`✅ Set torrent ${torrentId} as freeleech`);
                }
            }
            catch (error) {
                console.log(`⚠️ Could not set freeleech: ${error}`);
            }
        }
        const mamCookie = `mam_id=${MAM_ID}`;
        let torrentId;
        let duplicateTorrentHash;
        try {
            torrentId = await delugeClient.downloadTorrentFromUrl(downloadUrl, mamCookie, torrentName);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Torrent already in session')) {
                const hashMatch = error.message.match(/\(([a-f0-9]{40})\)/);
                if (hashMatch) {
                    duplicateTorrentHash = hashMatch[1];
                }
                console.log(`Duplicate torrent detected: ${duplicateTorrentHash || 'unknown hash'}`);
                const existingTorrents = await delugeClient.getTorrents();
                const existingTorrent = duplicateTorrentHash
                    ? existingTorrents.find((t) => t.id === duplicateTorrentHash)
                    : existingTorrents.find((t) => torrentName && t.name && t.name.toLowerCase().includes(torrentName.toLowerCase().substring(0, 20)));
                if (existingTorrent) {
                    return res.json({
                        isDuplicate: true,
                        isDuplicateError: true,
                        torrentId: existingTorrent.id,
                        torrentInfo: {
                            name: existingTorrent.name,
                            state: existingTorrent.state,
                            progress: existingTorrent.progress || 0
                        },
                        canUploadToGDrive: existingTorrent.state === 'Seeding' || (existingTorrent.progress && existingTorrent.progress >= 100),
                        message: `Torrent already exists in Deluge. ${existingTorrent.state === 'Seeding' || (existingTorrent.progress && existingTorrent.progress >= 100) ? 'Ready for Google Drive upload.' : 'Still downloading.'}`
                    });
                }
                else {
                    return res.status(409).json({
                        error: 'Torrent already exists in Deluge but could not be found',
                        isDuplicate: true,
                        isDuplicateError: true,
                        duplicateHash: duplicateTorrentHash
                    });
                }
            }
            else {
                throw error;
            }
        }
        const existingTorrents = await delugeClient.getTorrents();
        const torrentInfo = existingTorrents.find((t) => t.id === torrentId);
        const isExisting = torrentInfo && torrentInfo.progress !== undefined && torrentInfo.progress > 0;
        return res.json({
            torrentId,
            isDuplicate: isExisting,
            isDuplicateError: false,
            torrentInfo: torrentInfo ? {
                name: torrentInfo.name,
                state: torrentInfo.state,
                progress: torrentInfo.progress || 0
            } : undefined,
            canUploadToGDrive: torrentInfo && (torrentInfo.state === 'Seeding' || (torrentInfo.progress && torrentInfo.progress >= 100)),
            message: isExisting
                ? `Torrent already exists in Deluge (ID: ${torrentId})`
                : 'Torrent added successfully to Deluge'
        });
    }
    catch (error) {
        console.error('Error in download endpoint:', error);
        return res.status(500).json({ error: 'Failed to download and add torrent' });
    }
});
router.post('/freeleech', async (req, res) => {
    try {
        const validatedRequest = FreeleechRequestSchema.parse(req.body);
        const { MAM_BASE_URL, MAM_ID } = process.env;
        if (!MAM_ID) {
            return res.status(500).json({ error: 'MAM_ID is not configured' });
        }
        const mamClient = new mamClient_1.MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
        const result = await mamClient.setFreeleech(validatedRequest.id);
        if (result.success) {
            return res.json({
                success: true,
                message: `Torrent ${validatedRequest.id} set as freeleech`
            });
        }
        else {
            return res.status(500).json({
                error: 'Failed to set torrent as freeleech',
                details: result.error
            });
        }
    }
    catch (error) {
        console.error('Error in freeleech endpoint:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Invalid request parameters',
                details: error.errors
            });
        }
        return res.status(500).json({ error: 'Failed to set freeleech' });
    }
});
router.post('/check-duplicate', async (req, res) => {
    try {
        const validatedRequest = DuplicateCheckRequestSchema.parse(req.body);
        const { DELUGE_URL, DELUGE_PASSWORD, MAM_BASE_URL, MAM_ID } = process.env;
        if (!DELUGE_URL || !DELUGE_PASSWORD) {
            return res.status(500).json({ error: 'Deluge configuration is missing' });
        }
        if (!MAM_ID) {
            return res.status(500).json({ error: 'MAM_ID is not configured' });
        }
        const delugeManager = delugeClientManager_1.default.getInstance();
        delugeManager.initialize(DELUGE_URL, DELUGE_PASSWORD);
        const delugeClient = await delugeManager.getClient();
        const mamClient = new mamClient_1.MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
        let torrentName;
        try {
            const torrentDetails = await mamClient.getTorrentDetails(validatedRequest.torrentId.toString());
            torrentName = torrentDetails.title;
        }
        catch (error) {
            console.log('Could not fetch torrent details for duplicate checking:', error);
        }
        const existingTorrents = await delugeClient.getTorrents();
        let duplicateTorrent = null;
        if (torrentName) {
            duplicateTorrent = existingTorrents.find((t) => t.name && t.name.toLowerCase().includes(torrentName.toLowerCase().substring(0, 20)));
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
        }
        else {
            return res.json({
                isDuplicate: false,
                message: 'Torrent not found in Deluge'
            });
        }
    }
    catch (error) {
        console.error('Error in duplicate check endpoint:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Invalid request parameters',
                details: error.errors
            });
        }
        return res.status(500).json({ error: 'Failed to check for duplicates' });
    }
});
router.get('/test-connection', async (_req, res) => {
    try {
        const { MAM_BASE_URL, MAM_ID } = process.env;
        if (!MAM_ID) {
            return res.status(500).json({ error: 'MAM_ID is not configured' });
        }
        const mamClient = new mamClient_1.MamClient(MAM_BASE_URL || 'https://www.myanonamouse.net', MAM_ID);
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
        }
        catch (searchError) {
            return res.status(500).json({
                success: false,
                error: 'MAM search failed',
                details: searchError instanceof Error ? searchError.message : 'Unknown error',
                mam_id_format: MAM_ID.substring(0, 20) + '...'
            });
        }
    }
    catch (error) {
        console.error('Error testing MAM connection:', error);
        return res.status(500).json({ error: 'Failed to test MAM connection' });
    }
});
router.get('/help', async (_req, res) => {
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
    }
    catch (error) {
        console.error('Error in help endpoint:', error);
        return res.status(500).json({ error: 'Failed to retrieve help documentation' });
    }
});
exports.default = router;
//# sourceMappingURL=mam.js.map