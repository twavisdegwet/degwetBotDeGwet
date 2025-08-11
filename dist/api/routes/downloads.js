"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const downloadManagement_1 = require("../clients/downloadManagement");
const delugeClientManager_1 = __importDefault(require("../clients/delugeClientManager"));
const uploadUtils_1 = require("../../bot/uploadUtils");
const router = (0, express_1.Router)();
const getDelugeClient = async () => {
    const clientManager = delugeClientManager_1.default.getInstance();
    return await clientManager.getClient();
};
router.post('/webhook', async (req, res) => {
    try {
        const { event, torrentId, torrentName } = req.body;
        console.log(`📥 Deluge webhook event received: ${event} for torrent ${torrentName} (${torrentId})`);
        if (event === 'torrent_completed') {
            const delugeClient = await getDelugeClient();
            const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
            const torrentInfo = await downloadManager.getTorrentInfo(torrentId);
            if (!torrentInfo) {
                console.error(`❌ Could not get info for completed torrent: ${torrentId}`);
                return res.status(404).json({
                    success: false,
                    error: 'Torrent not found'
                });
            }
            console.log(`🎉 Torrent completed: ${torrentInfo.name}`);
            try {
                console.log(`🔄 Queued ${torrentInfo.name} for Google Drive upload`);
            }
            catch (uploadError) {
                console.error(`❌ Error initiating upload for ${torrentInfo.name}:`, uploadError);
            }
            return res.json({
                success: true,
                message: 'Torrent completion acknowledged'
            });
        }
        return res.json({
            success: true,
            message: 'Event received but not processed'
        });
    }
    catch (error) {
        console.error('Error handling Deluge webhook:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process webhook event'
        });
    }
});
router.get('/completed', async (_req, res) => {
    try {
        const delugeClient = await getDelugeClient();
        const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
        const completedTorrents = await downloadManager.listCompletedTorrents();
        const pendingUploads = completedTorrents.filter(_torrent => {
            return true;
        });
        return res.json({
            success: true,
            torrents: pendingUploads
        });
    }
    catch (error) {
        console.error('Error listing completed torrents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to list completed torrents'
        });
    }
});
router.post('/upload-completed', async (req, res) => {
    try {
        const { convertMp3ToM4b = false } = req.body;
        const delugeClient = await getDelugeClient();
        const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
        const completedTorrents = await downloadManager.listCompletedTorrents();
        if (completedTorrents.length === 0) {
            return res.json({
                success: true,
                message: 'No completed torrents to upload'
            });
        }
        console.log(`📤 Starting upload process for ${completedTorrents.length} completed torrents`);
        const results = [];
        for (const torrent of completedTorrents) {
            try {
                console.log(`🔄 Uploading ${torrent.name} (${torrent.id}) to Google Drive...`);
                const result = await (0, uploadUtils_1.uploadTorrentToGDrive)(torrent.id, convertMp3ToM4b);
                results.push({
                    torrentId: torrent.id,
                    torrentName: torrent.name,
                    success: result.success,
                    message: result.message,
                    error: result.error
                });
                if (result.success) {
                    console.log(`✅ Successfully uploaded ${torrent.name} to Google Drive`);
                }
                else {
                    console.error(`❌ Failed to upload ${torrent.name} to Google Drive: ${result.error}`);
                }
            }
            catch (error) {
                console.error(`❌ Error uploading ${torrent.name}:`, error);
                results.push({
                    torrentId: torrent.id,
                    torrentName: torrent.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return res.json({
            success: true,
            results
        });
    }
    catch (error) {
        console.error('Error uploading completed torrents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to upload completed torrents'
        });
    }
});
exports.default = router;
//# sourceMappingURL=downloads.js.map