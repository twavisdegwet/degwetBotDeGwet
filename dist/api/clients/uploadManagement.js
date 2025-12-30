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
const ebookConverter_1 = require("../../utils/ebookConverter");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000, operationName = 'operation') {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, error);
                throw error;
            }
            const isNetworkError = error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                error.code === 'ECONNRESET' ||
                error.code === 'ENOTFOUND' ||
                error.message?.includes('timeout') ||
                error.message?.includes('connect');
            if (!isNetworkError) {
                throw error;
            }
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
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
    }
    async cleanTempDirectory() {
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
            console.log('🧹 Cleaned entire temp directory. I\'m tidier than Jon\'s cooking attempts.');
        }
        catch (error) {
            console.error('❌ Error cleaning temp directory. This mess is worse than Odie\'s drool:', error);
        }
    }
    async isAuthenticated() {
        try {
            await retryWithBackoff(() => this.drive.about.get({ fields: 'user' }), 3, 1000, 'Google Drive authentication');
            const message = '✅ Google Drive authentication successful! I\'m more connected than Jon is to reality.';
            console.log(message);
            return true;
        }
        catch (error) {
            console.error('❌ Authentication check failed. This is worse than a Monday without lasagna:', error);
            return false;
        }
    }
    async createFolder(name, parentId, progressCallback) {
        try {
            console.log(`📁 Creating folder "${name}"`);
            const fileMetadata = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder'
            };
            const effectiveParentId = parentId || this.parentFolderId;
            if (effectiveParentId) {
                fileMetadata.parents = [effectiveParentId];
            }
            const response = await retryWithBackoff(() => this.drive.files.create({
                requestBody: fileMetadata,
                fields: 'id',
                supportsAllDrives: true
            }), 3, 1000, 'Google Drive folder creation');
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
            const response = await retryWithBackoff(() => this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
                supportsAllDrives: true
            }), 3, 2000, `Google Drive file upload (${fileName})`);
            return response.data.id;
        }
        catch (error) {
            console.error('Error uploading file:', error);
            throw new Error(`Failed to upload file: ${fileName}`);
        }
    }
    async copyFilesToTemp(files, basePath) {
        const tempSessionDir = path_1.default.join(this.tempDir, `session_${Date.now()}`);
        fs_1.default.mkdirSync(tempSessionDir, { recursive: true });
        const startMessage = `📋 Copying ${files.length} files to temp directory. This is harder work than avoiding Mondays.`;
        console.log(startMessage);
        const copiedFiles = [];
        for (const file of files) {
            const sourcePath = path_1.default.join(basePath, file.path);
            const fileName = path_1.default.basename(file.path);
            const destPath = path_1.default.join(tempSessionDir, fileName);
            try {
                await execAsync(`cp "${sourcePath}" "${destPath}"`);
                copiedFiles.push(destPath);
                console.log(`✅ Copied: ${fileName}`);
            }
            catch (error) {
                console.error(`❌ Failed to copy ${fileName}. This is more frustrating than Odie's existence:`, error);
            }
        }
        const finishMessage = `🎉 Finished copying ${copiedFiles.length} files! I deserve a nap and a whole pan of lasagna.`;
        console.log(finishMessage);
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
    async convertEbooksImproved(tempDir, _torrentName) {
        try {
            const ebookCheck = await (0, ebookConverter_1.hasConvertibleEbooks)(tempDir);
            if (!ebookCheck.hasConvertible) {
                console.log(`📚 No ebook conversion needed: ${ebookCheck.reason}`);
                return { convertedFiles: [], sourceFiles: [] };
            }
            console.log(`📚 Converting ebooks to EPUB + MOBI... This is more work than I usually do in a week!`);
            console.log(`Found ${ebookCheck.files.length} file(s) to convert: ${ebookCheck.reason}`);
            const convertedFiles = [];
            const sourceFiles = [];
            for (const sourceFile of ebookCheck.files) {
                const result = await (0, ebookConverter_1.convertEbook)(sourceFile, {
                    autoApprove: true
                });
                if (result.success) {
                    const durationSeconds = Math.round((result.duration || 0) / 1000);
                    console.log(`✅ Ebook conversion successful! Took ${durationSeconds} seconds.`);
                    sourceFiles.push(sourceFile);
                    if (result.epubPath && fs_1.default.existsSync(result.epubPath)) {
                        convertedFiles.push(result.epubPath);
                        console.log(`  📗 EPUB: ${path_1.default.basename(result.epubPath)}`);
                    }
                    if (result.mobiPath && fs_1.default.existsSync(result.mobiPath)) {
                        convertedFiles.push(result.mobiPath);
                        console.log(`  📘 MOBI: ${path_1.default.basename(result.mobiPath)}`);
                    }
                    if (!result.epubPath && !result.mobiPath) {
                        console.warn(`  ⚠️  No output files created from: ${path_1.default.basename(sourceFile)}`);
                    }
                }
                else {
                    console.error(`❌ Ebook conversion failed: ${result.error}`);
                }
            }
            if (convertedFiles.length > 0) {
                console.log(`✅ Ebook conversion completed! Created ${convertedFiles.length} file(s).`);
            }
            return { convertedFiles, sourceFiles };
        }
        catch (error) {
            console.error('❌ Error in ebook conversion:', error);
            return { convertedFiles: [], sourceFiles: [] };
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
            console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
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
            await this.cleanTempDirectory();
            if (!(await this.isAuthenticated())) {
                throw new Error('Cannot authenticate with Google Drive');
            }
            const contentAnalysis = this.analyzeContentType(torrentObject.files);
            const formatFileSize = (bytes) => {
                if (bytes === 0)
                    return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };
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
                const analysisMessage = `Content analysis: ${contentAnalysis.type} (${contentAnalysis.audioFiles.length} audio, ${contentAnalysis.ebookFiles.length} ebook, ${contentAnalysis.otherFiles.length} other files, ${formatFileSize(contentAnalysis.totalSize)})`;
                console.log(analysisMessage);
                folderId = await this.createFolder(folderName, options.parentFolderId);
                const folderMessage = `Created folder: ${folderName} (ID: ${folderId})`;
                console.log(folderMessage);
            }
            else {
                const analysisMessage = `Content analysis: ${contentAnalysis.type} (${contentAnalysis.audioFiles.length} audio, ${contentAnalysis.ebookFiles.length} ebook, ${contentAnalysis.otherFiles.length} other files, ${formatFileSize(contentAnalysis.totalSize)})

📋 Copying files to temporary directory... Andrew Garfield would be proud of this level of dedication. To Lasagna`;
                console.log(analysisMessage);
                if (progressCallback)
                    progressCallback(analysisMessage);
            }
            const copiedFiles = await this.copyFilesToTemp(torrentObject.files, basePath);
            if (copiedFiles.length === 0) {
                throw new Error('No files were successfully copied to temp directory');
            }
            const tempSessionDir = path_1.default.dirname(copiedFiles[0]);
            const mp3Files = copiedFiles.filter(file => file.endsWith('.mp3'));
            let filesToUpload = copiedFiles;
            if (options.convertMp3ToM4b && mp3Files.length > 1) {
                const conversionStartMessage = 'Converting MP3 files to M4B (this will take like 30 minutes per half GB)...';
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
            else if (options.convertMp3ToM4b && mp3Files.length === 1) {
                console.log('📀 Single MP3 file detected - skipping conversion and uploading as-is. Even I know when to take a shortcut.');
                if (progressCallback)
                    progressCallback('Single MP3 file - uploading without conversion');
            }
            if (options.convertEbooks) {
                const ebookConversionMessage = 'Converting ebooks to EPUB + MOBI formats...';
                console.log(ebookConversionMessage);
                if (progressCallback)
                    progressCallback(ebookConversionMessage);
                const ebookResult = await this.convertEbooksImproved(tempSessionDir, torrentObject.name);
                if (ebookResult.convertedFiles.length > 0) {
                    for (const sourceFile of ebookResult.sourceFiles) {
                        filesToUpload = filesToUpload.filter(file => file !== sourceFile);
                        console.log(`  🗑️  Removing source file from upload: ${path_1.default.basename(sourceFile)}`);
                    }
                    filesToUpload.push(...ebookResult.convertedFiles);
                    console.log(`  ✅ Added ${ebookResult.convertedFiles.length} converted file(s) to upload`);
                }
            }
            const uploadStartMessage = `📤 Uploading ${filesToUpload.length} files to Google Drive...`;
            console.log(uploadStartMessage);
            if (progressCallback)
                progressCallback(uploadStartMessage);
            for (const filePath of filesToUpload) {
                const fileName = path_1.default.basename(filePath);
                if (!fs_1.default.existsSync(filePath)) {
                    console.error(`❌ File does not exist, skipping upload: ${filePath}`);
                    continue;
                }
                try {
                    const fileId = await this.uploadFile(filePath, fileName, folderId);
                    uploadedFiles.push(fileName);
                    console.log(`Uploaded: ${fileName} (ID: ${fileId})`);
                    if (uploadedFiles.length % 10 === 0 || uploadedFiles.length === filesToUpload.length) {
                        console.log(`📤 Uploaded ${uploadedFiles.length}/${filesToUpload.length} files...`);
                    }
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
                folderId,
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
