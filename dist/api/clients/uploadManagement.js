"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadManagementClient = void 0;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const mp3Converter_1 = require("../../utils/mp3Converter");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class UploadManagementClient {
    auth;
    drive;
    parentFolderId;
    tempDir = '/tmp/discord-bot-uploads';
    constructor(serviceAccountPath, parentFolderId) {
        const credentials = JSON.parse(fs_1.default.readFileSync(serviceAccountPath, 'utf8'));
        this.auth = new google_auth_library_1.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata'
            ]
        });
        this.drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
        this.parentFolderId = parentFolderId;
        if (!fs_1.default.existsSync(this.tempDir)) {
            fs_1.default.mkdirSync(this.tempDir, { recursive: true });
        }
        else {
            try {
                const files = fs_1.default.readdirSync(this.tempDir);
                for (const file of files) {
                    const filePath = path_1.default.join(this.tempDir, file);
                    if (fs_1.default.statSync(filePath).isDirectory()) {
                        (0, child_process_1.execSync)(`rm -rf "${filePath}"`);
                    }
                    else {
                        fs_1.default.unlinkSync(filePath);
                    }
                }
            }
            catch (error) {
                console.error('Error cleaning temp directory:', error);
            }
        }
    }
    async isAuthenticated(progressCallback) {
        try {
            await this.drive.about.get({ fields: 'user' });
            const message = '✅ Google Drive authentication successful! I\'m more connected than Jon is to reality.';
            console.log(message);
            if (progressCallback)
                progressCallback(message);
            return true;
        }
        catch (error) {
            console.error('❌ Authentication check failed. This is worse than a Monday without lasagna:', error);
            return false;
        }
    }
    async createFolder(name, parentId, progressCallback) {
        try {
            const createMessage = `📁 Creating folder "${name}" - This is more organized than Jon's sock drawer.`;
            console.log(createMessage);
            if (progressCallback)
                progressCallback(createMessage);
            const fileMetadata = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder'
            };
            const effectiveParentId = parentId || this.parentFolderId;
            if (effectiveParentId) {
                fileMetadata.parents = [effectiveParentId];
            }
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                fields: 'id',
                supportsAllDrives: true
            });
            const successMessage = `✅ Folder created successfully! I'm more productive than Odie on his best day.`;
            console.log(successMessage);
            if (progressCallback)
                progressCallback(successMessage);
            return response.data.id;
        }
        catch (error) {
            console.error('❌ Error creating folder. I blame Nermal for being too distracting:', error);
            throw new Error(`Failed to create folder: ${name}`);
        }
    }
    async uploadFile(filePath, fileName, parentId) {
        try {
            const fileMetadata = {
                name: fileName
            };
            const effectiveParentId = parentId || this.parentFolderId;
            if (effectiveParentId) {
                fileMetadata.parents = [effectiveParentId];
            }
            const media = {
                mimeType: 'application/octet-stream',
                body: fs_1.default.createReadStream(filePath)
            };
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
                supportsAllDrives: true
            });
            return response.data.id;
        }
        catch (error) {
            console.error('Error uploading file:', error);
            throw new Error(`Failed to upload file: ${fileName}`);
        }
    }
    async copyFilesToTemp(files, basePath, progressCallback) {
        const tempSessionDir = path_1.default.join(this.tempDir, `session_${Date.now()}`);
        fs_1.default.mkdirSync(tempSessionDir, { recursive: true });
        const startMessage = `📋 Copying ${files.length} files to temp directory. This is harder work than avoiding Mondays.`;
        console.log(startMessage);
        if (progressCallback)
            progressCallback(startMessage);
        const copiedFiles = [];
        for (const file of files) {
            const sourcePath = path_1.default.join(basePath, file.path);
            const fileName = path_1.default.basename(file.path);
            const destPath = path_1.default.join(tempSessionDir, fileName);
            try {
                await execAsync(`cp "${sourcePath}" "${destPath}"`);
                copiedFiles.push(destPath);
                const copyMessage = `✅ Copied: ${fileName} - One step closer to my lasagna break.`;
                console.log(copyMessage);
                if (progressCallback)
                    progressCallback(copyMessage);
            }
            catch (error) {
                console.error(`❌ Failed to copy ${fileName}. This is more frustrating than Odie's existence:`, error);
            }
        }
        const finishMessage = `🎉 Finished copying files! I deserve a nap and a whole pan of lasagna.`;
        console.log(finishMessage);
        if (progressCallback)
            progressCallback(finishMessage);
        return copiedFiles;
    }
    extractMetadataFromName(torrentName) {
        let title;
        let author;
        let cleanName = torrentName
            .replace(/\.(mp3|m4a|m4b|flac|audiobook)$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanName.includes(' - By ')) {
            const parts = cleanName.split(' - By ');
            if (parts.length === 2) {
                title = parts[0].trim();
                author = parts[1].trim();
            }
        }
        else if (cleanName.includes(' by ')) {
            const parts = cleanName.split(' by ');
            if (parts.length === 2) {
                title = parts[0].trim();
                author = parts[1].trim();
            }
        }
        else if (cleanName.includes(' - ')) {
            const parts = cleanName.split(' - ');
            if (parts.length === 2) {
                const firstPart = parts[0].trim();
                const secondPart = parts[1].trim();
                if (firstPart.length < secondPart.length && firstPart.split(' ').length <= 3) {
                    author = firstPart;
                    title = secondPart;
                }
                else {
                    title = firstPart;
                    author = secondPart;
                }
            }
        }
        else if (cleanName.includes('(') && cleanName.includes(')')) {
            const match = cleanName.match(/^(.+?)\s*\((.+?)\)$/);
            if (match) {
                title = match[1].trim();
                author = match[2].trim();
            }
        }
        return { title, author };
    }
    async convertMp3ToM4bImproved(tempDir, torrentName) {
        try {
            const hasMP3s = await (0, mp3Converter_1.hasMP3Files)(tempDir);
            if (!hasMP3s) {
                console.log('🎵 No MP3 files found for conversion. That\'s disappointing. Like finding an empty lasagna pan.');
                return null;
            }
            console.log('🎵 Converting MP3 files to M4B... This will take longer than my afternoon nap, but it\'ll be worth it!');
            const metadata = this.extractMetadataFromName(torrentName);
            console.log('📖 Extracted metadata like a detective. I\'m basically Sherlock Holmes, but lazier:', metadata);
            const result = await (0, mp3Converter_1.convertMp3ToM4b)(tempDir, {
                title: metadata.title,
                author: metadata.author,
                autoApprove: true
            });
            if (result.success && result.outputPath) {
                const durationMinutes = Math.round((result.duration || 0) / 1000 / 60);
                console.log(`✅ MP3 to M4B conversion successful! I'm more accomplished than Jon on his best day: ${result.outputPath}`);
                console.log(`⏱️  Conversion took: ${durationMinutes} minutes. That's ${durationMinutes} minutes I could have spent napping.`);
                return result.outputPath;
            }
            else {
                console.error(`❌ MP3 to M4B conversion failed. This is worse than a Monday morning: ${result.error}`);
                return null;
            }
        }
        catch (error) {
            console.error('❌ Error in MP3 to M4B conversion. I blame Nermal for being too distracting:', error);
            return null;
        }
    }
    analyzeContentType(files) {
        const audioExtensions = ['.mp3', '.m4a', '.m4b', '.flac', '.wav', '.aac'];
        const ebookExtensions = ['.epub', '.mobi', '.azw3', '.azw', '.pdf', '.txt', '.fb2'];
        const audioFiles = [];
        const ebookFiles = [];
        const otherFiles = [];
        let totalSize = 0;
        for (const file of files) {
            const ext = path_1.default.extname(file.path).toLowerCase();
            const fileName = path_1.default.basename(file.path);
            totalSize += file.size;
            if (audioExtensions.includes(ext)) {
                audioFiles.push(fileName);
            }
            else if (ebookExtensions.includes(ext)) {
                ebookFiles.push(fileName);
            }
            else {
                otherFiles.push(fileName);
            }
        }
        let type;
        if (audioFiles.length > 0 && ebookFiles.length > 0) {
            type = 'mixed';
        }
        else if (audioFiles.length > 0) {
            type = 'audiobook';
        }
        else if (ebookFiles.length > 0) {
            type = 'ebook';
        }
        else {
            type = 'unknown';
        }
        return {
            type,
            audioFiles,
            ebookFiles,
            otherFiles,
            totalSize
        };
    }
    async cleanupTemp(tempDir) {
        try {
            await execAsync(`rm -rf "${tempDir}"`);
            console.log(`🧹 Cleaned up temp directory: ${tempDir}. I'm tidier than Jon's cooking attempts.`);
        }
        catch (error) {
            console.error('❌ Error cleaning up temp directory. This mess is worse than Odie\'s drool:', error);
        }
    }
    async uploadTorrent(torrentObject, options = {}) {
        const uploadedFiles = [];
        let folderId;
        let convertedFile;
        const { progressCallback } = options;
        try {
            if (!(await this.isAuthenticated(progressCallback))) {
                throw new Error('Cannot authenticate with Google Drive');
            }
            const contentAnalysis = this.analyzeContentType(torrentObject.files);
            const analysisMessage = `Content analysis: ${contentAnalysis.type} (${contentAnalysis.audioFiles.length} audio, ${contentAnalysis.ebookFiles.length} ebook, ${contentAnalysis.otherFiles.length} other files)`;
            console.log(analysisMessage);
            if (progressCallback)
                progressCallback(analysisMessage);
            const basePath = torrentObject.savePath || '/mnt/nas/nzbget/nzb/completed/torrent';
            if (options.createSubfolder !== false) {
                let folderPrefix = '';
                switch (contentAnalysis.type) {
                    case 'audiobook':
                        folderPrefix = '[Audiobook] ';
                        break;
                    case 'ebook':
                        folderPrefix = '[E-book] ';
                        break;
                    case 'mixed':
                        folderPrefix = '[Mixed Media] ';
                        break;
                    default:
                        folderPrefix = '';
                }
                const folderName = folderPrefix + torrentObject.name;
                folderId = await this.createFolder(folderName, options.parentFolderId, progressCallback);
                const folderMessage = `Created folder: ${folderName} (ID: ${folderId})`;
                console.log(folderMessage);
                if (progressCallback)
                    progressCallback(folderMessage);
            }
            const copyStartMessage = 'Copying files to temporary directory...';
            console.log(copyStartMessage);
            if (progressCallback)
                progressCallback(copyStartMessage);
            const copiedFiles = await this.copyFilesToTemp(torrentObject.files, basePath, progressCallback);
            if (copiedFiles.length === 0) {
                throw new Error('No files were successfully copied to temp directory');
            }
            const tempSessionDir = path_1.default.dirname(copiedFiles[0]);
            const mp3Files = copiedFiles.filter(file => file.endsWith('.mp3'));
            let filesToUpload = copiedFiles;
            if (options.convertMp3ToM4b && mp3Files.length > 0) {
                const conversionStartMessage = 'Converting MP3 files to M4B...';
                console.log(conversionStartMessage);
                if (progressCallback)
                    progressCallback(conversionStartMessage);
                const m4bFile = await this.convertMp3ToM4bImproved(tempSessionDir, torrentObject.name);
                if (m4bFile) {
                    filesToUpload = copiedFiles.filter(file => !file.endsWith('.mp3'));
                    filesToUpload.push(m4bFile);
                    convertedFile = path_1.default.basename(m4bFile);
                }
            }
            const uploadStartMessage = `Uploading ${filesToUpload.length} files to Google Drive...`;
            console.log(uploadStartMessage);
            if (progressCallback)
                progressCallback(uploadStartMessage);
            for (const filePath of filesToUpload) {
                const fileName = path_1.default.basename(filePath);
                try {
                    const fileId = await this.uploadFile(filePath, fileName, folderId);
                    uploadedFiles.push(fileName);
                    const uploadMessage = `Uploaded: ${fileName} (ID: ${fileId})`;
                    console.log(uploadMessage);
                    if (progressCallback)
                        progressCallback(uploadMessage);
                }
                catch (error) {
                    console.error(`Failed to upload ${fileName}:`, error);
                }
            }
            await this.cleanupTemp(tempSessionDir);
            return {
                success: true,
                folderId,
                uploadedFiles,
                convertedFile,
                contentAnalysis
            };
        }
        catch (error) {
            console.error('Error uploading torrent:', error);
            return {
                success: false,
                uploadedFiles,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getUserInfo() {
        try {
            const response = await this.drive.about.get({
                fields: 'user,storageQuota'
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting user info:', error);
            throw new Error('Failed to get Google Drive user info');
        }
    }
    async listFiles(parentId, maxResults = 10) {
        try {
            const query = parentId ? `'${parentId}' in parents` : undefined;
            const response = await this.drive.files.list({
                q: query,
                pageSize: maxResults,
                fields: 'files(id,name,mimeType,size,createdTime)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });
            return response.data.files || [];
        }
        catch (error) {
            console.error('Error listing files:', error);
            throw new Error('Failed to list Google Drive files');
        }
    }
}
exports.UploadManagementClient = UploadManagementClient;
//# sourceMappingURL=uploadManagement.js.map