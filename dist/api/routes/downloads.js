"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../../config/env");
const router = express_1.default.Router();
const isAudioBookOrEbook = (filename) => {
    const audioExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.ogg'];
    const ebookExtensions = ['.epub', '.mobi', '.azw', '.pdf', '.txt'];
    const lowerFilename = filename.toLowerCase();
    for (const ext of audioExtensions) {
        if (lowerFilename.endsWith(ext)) {
            return true;
        }
    }
    for (const ext of ebookExtensions) {
        if (lowerFilename.endsWith(ext)) {
            return true;
        }
    }
    return false;
};
const getFileDetails = async (filePath) => {
    try {
        const stats = await promises_1.default.stat(filePath);
        const basename = path_1.default.basename(filePath);
        return {
            name: basename,
            path: filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime
        };
    }
    catch (error) {
        console.error(`Error getting file details for ${filePath}:`, error);
        return null;
    }
};
router.get('/list', async (_req, res) => {
    try {
        const downloadDirectory = env_1.env.DOWNLOADS_DIRECTORY;
        try {
            await promises_1.default.access(downloadDirectory);
        }
        catch (error) {
            return res.status(500).json({
                error: 'Download directory does not exist',
                directory: downloadDirectory
            });
        }
        const files = await promises_1.default.readdir(downloadDirectory);
        const filteredFiles = files.filter(file => isAudioBookOrEbook(file));
        const fileDetailsPromises = filteredFiles.map(async (file) => {
            const fullPath = path_1.default.join(downloadDirectory, file);
            return await getFileDetails(fullPath);
        });
        const fileDetails = await Promise.all(fileDetailsPromises);
        const validFileDetails = fileDetails.filter(detail => detail !== null);
        validFileDetails.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
        return res.json({
            directory: downloadDirectory,
            count: validFileDetails.length,
            files: validFileDetails
        });
    }
    catch (error) {
        console.error('Error listing downloads:', error);
        return res.status(500).json({
            error: 'Failed to list downloads',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/file/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const downloadDirectory = env_1.env.DOWNLOADS_DIRECTORY;
        const fullPath = path_1.default.join(downloadDirectory, filename);
        if (!isAudioBookOrEbook(filename)) {
            return res.status(400).json({
                error: 'File is not an audio book or ebook',
                filename
            });
        }
        const fileDetails = await getFileDetails(fullPath);
        return res.json({
            success: true,
            file: fileDetails
        });
    }
    catch (error) {
        console.error('Error getting file info:', error);
        if (error instanceof Error && error.message.includes('ENOENT')) {
            return res.status(404).json({
                error: 'File not found',
                filename: req.params.filename
            });
        }
        return res.status(500).json({
            error: 'Failed to get file information',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=downloads.js.map