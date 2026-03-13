"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadManagement_1 = require("../clients/uploadManagement");
const router = (0, express_1.Router)();
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const uploadClient = new uploadManagement_1.UploadManagementClient(serviceAccountJson, driveFolderId);
router.get('/status', async (_req, res) => {
    try {
        const serviceAccountConfigured = !!serviceAccountJson;
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
            serviceAccountConfigured,
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
        const { torrentId, convertMp3ToM4b = false } = req.body;
        if (!torrentId) {
            return res.status(400).json({
                success: false,
                error: 'Torrent ID is required'
            });
        }
        const { uploadTorrentToGDrive } = await Promise.resolve().then(() => __importStar(require('../../bot/uploadUtils')));
        const result = await uploadTorrentToGDrive(torrentId, convertMp3ToM4b);
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
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
