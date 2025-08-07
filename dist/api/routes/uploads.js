"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadManagement_1 = require("../clients/uploadManagement");
const delugeClient_1 = require("../clients/delugeClient");
const env_1 = require("../../config/env");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    path_1.default.join(__dirname, '../../../samplefiles/discord-468217-313c7eccba67.json');
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1v7E_LESO6hE-vFFXcBE5WDjLocdbZ6nQ';
const uploadClient = new uploadManagement_1.UploadManagementClient(serviceAccountPath, driveFolderId);
router.get('/status', async (_req, res) => {
    try {
        const serviceAccountExists = fs_1.default.existsSync(serviceAccountPath);
        const isAuthenticated = await uploadClient.isAuthenticated();
        let userInfo = null;
        if (isAuthenticated) {
            try {
                userInfo = await uploadClient.getUserInfo();
            }
            catch (error) {
                console.error('Error getting user info:', error);
            }
        }
        res.json({
            success: true,
            serviceAccountFileExists: serviceAccountExists,
            authenticated: isAuthenticated,
            folderId: driveFolderId,
            user: userInfo?.user || null,
            storage: userInfo?.storageQuota || null
        });
    }
    catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check service account status'
        });
    }
});
router.post('/torrent', async (req, res) => {
    try {
        const { torrentId, convertMp3ToM4b = false, parentFolderId } = req.body;
        if (!torrentId) {
            return res.status(400).json({
                success: false,
                error: 'Torrent ID is required'
            });
        }
        const delugeClient = new delugeClient_1.DelugeClient(process.env.DELUGE_URL || 'http://localhost:8112', process.env.DELUGE_PASSWORD || 'deluge');
        const torrentStatus = await delugeClient.getTorrentStatus(torrentId);
        const torrentFiles = await delugeClient.getTorrentFiles(torrentId);
        if (torrentFiles.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No files found for this torrent'
            });
        }
        const torrentObject = {
            id: torrentId,
            name: torrentStatus.name,
            files: torrentFiles,
            savePath: env_1.env.DOWNLOADS_DIRECTORY
        };
        const result = await uploadClient.uploadTorrent(torrentObject, {
            convertMp3ToM4b,
            parentFolderId,
            createSubfolder: true
        });
        if (result.success) {
            return res.json({
                success: true,
                message: `Successfully uploaded ${result.uploadedFiles.length} files to Google Drive`,
                folderId: result.folderId,
                uploadedFiles: result.uploadedFiles,
                convertedFile: result.convertedFile
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Upload failed',
                uploadedFiles: result.uploadedFiles
            });
        }
    }
    catch (error) {
        console.error('Error uploading torrent:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload torrent'
        });
    }
});
router.get('/files', async (req, res) => {
    try {
        const { parentId, maxResults = 10 } = req.query;
        const files = await uploadClient.listFiles(parentId, parseInt(maxResults));
        res.json({
            success: true,
            files
        });
    }
    catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list Google Drive files'
        });
    }
});
exports.default = router;
//# sourceMappingURL=uploads.js.map