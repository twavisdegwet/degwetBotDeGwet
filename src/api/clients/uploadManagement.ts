import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { convertMp3ToM4b, hasMP3Files } from '../../utils/mp3Converter';
import { convertEbook, hasConvertibleEbooks } from '../../utils/ebookConverter';

const execAsync = promisify(exec);

/**
 * Retry wrapper for network operations with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      
      // Check if it's a network timeout/connection error
      const isNetworkError = error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                           error.code === 'ECONNRESET' ||
                           error.code === 'ENOTFOUND' ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('connect');
      
      if (!isNetworkError) {
        // If it's not a network error, don't retry
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export interface TorrentObject {
  id: string;
  name: string;
  files: Array<{
    path: string;
    size: number;
  }>;
  savePath?: string;
}

export interface UploadOptions {
  convertMp3ToM4b?: boolean;
  convertEbooks?: boolean;
  parentFolderId?: string;
  createSubfolder?: boolean;
  progressCallback?: (message: string) => void;
}

export interface ContentTypeAnalysis {
  type: 'audiobook' | 'ebook' | 'mixed' | 'unknown';
  audioFiles: string[];
  ebookFiles: string[];
  otherFiles: string[];
  totalSize: number;
}

export class UploadManagementClient {
  private auth: JWT;
  private drive: drive_v3.Drive;
  private parentFolderId?: string;
  private tempDir: string = '/tmp/discord-bot-uploads';

  constructor(serviceAccountPath: string, parentFolderId?: string) {
    // Load service account credentials
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    // Create JWT client for service account authentication
    this.auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata'
      ]
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.parentFolderId = parentFolderId;

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Clean the entire temp directory
   */
  private async cleanTempDirectory(): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          execSync(`rm -rf "${filePath}"`);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      console.log('🧹 Cleaned entire temp directory. I\'m tidier than Jon\'s cooking attempts.');
    } catch (error) {
      console.error('❌ Error cleaning temp directory. This mess is worse than Odie\'s drool:', error);
    }
  }

  /**
   * Check if client can authenticate with Google Drive
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await retryWithBackoff(
        () => this.drive.about.get({ fields: 'user' }),
        3,
        1000,
        'Google Drive authentication'
      );
      const message = '✅ Google Drive authentication successful! I\'m more connected than Jon is to reality.';
      console.log(message);
      return true;
    } catch (error) {
      console.error('❌ Authentication check failed. This is worse than a Monday without lasagna:', error);
      return false;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name: string, parentId?: string, progressCallback?: (message: string) => void): Promise<string> {
    try {
      console.log(`📁 Creating folder "${name}"`);
      
      const fileMetadata: any = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      // Use parentFolderId as default if no parentId provided
      const effectiveParentId = parentId || this.parentFolderId;
      if (effectiveParentId) {
        fileMetadata.parents = [effectiveParentId];
      }

      const response = await retryWithBackoff(
        () => this.drive.files.create({
          requestBody: fileMetadata,
          fields: 'id',
          supportsAllDrives: true
        }),
        3,
        1000,
        'Google Drive folder creation'
      );

      const successMessage = `✅ Folder created successfully! I'm more productive than Odie on his best day.`;
      console.log(successMessage);
      if (progressCallback) progressCallback(successMessage);
      return response.data.id!;
    } catch (error) {
      console.error('❌ Error creating folder. I blame Nermal for being too distracting:', error);
      throw new Error(`Failed to create folder: ${name}`);
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(filePath: string, fileName: string, parentId?: string): Promise<string> {
    try {
      const fileMetadata: any = {
        name: fileName
      };

      // Use parentFolderId as default if no parentId provided
      const effectiveParentId = parentId || this.parentFolderId;
      if (effectiveParentId) {
        fileMetadata.parents = [effectiveParentId];
      }

      const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath)
      };

      const response = await retryWithBackoff(
        () => this.drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id',
          supportsAllDrives: true
        }),
        3,
        2000, // Longer delay for file uploads
        `Google Drive file upload (${fileName})`
      );

      return response.data.id!;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${fileName}`);
    }
  }

  /**
   * Copy files to temp directory
   */
  private async copyFilesToTemp(files: Array<{path: string, size: number}>, basePath: string): Promise<string[]> {
    const tempSessionDir = path.join(this.tempDir, `session_${Date.now()}`);
    fs.mkdirSync(tempSessionDir, { recursive: true });
    
    const startMessage = `📋 Copying ${files.length} files to temp directory. This is harder work than avoiding Mondays.`;
    // Only log to console, don't send Discord messages for each file
    console.log(startMessage);
    
    const copiedFiles: string[] = [];

    for (const file of files) {
      const sourcePath = path.join(basePath, file.path);
      const fileName = path.basename(file.path);
      const destPath = path.join(tempSessionDir, fileName);

      try {
        await execAsync(`cp "${sourcePath}" "${destPath}"`);
        copiedFiles.push(destPath);
        // Only log to console, don't send Discord messages for each file
        console.log(`✅ Copied: ${fileName}`);
      } catch (error) {
        console.error(`❌ Failed to copy ${fileName}. This is more frustrating than Odie's existence:`, error);
      }
    }

    const finishMessage = `🎉 Finished copying ${copiedFiles.length} files! I deserve a nap and a whole pan of lasagna.`;
    console.log(finishMessage);
    // Don't send this as a separate Discord message, just log it
    return copiedFiles;
  }

  /**
   * Extract metadata from torrent name
   */
  private extractMetadataFromName(torrentName: string): { title?: string; author?: string } {
    // Common patterns for audiobook torrents:
    // "Title - By Author"
    // "Title by Author"
    // "Author - Title"
    // "Title (Author)"
    
    let title: string | undefined;
    let author: string | undefined;
    
    // Clean the name first
    let cleanName = torrentName
      .replace(/\.(mp3|m4a|m4b|flac|audiobook)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try "Title - By Author" pattern
    if (cleanName.includes(' - By ')) {
      const parts = cleanName.split(' - By ');
      if (parts.length === 2) {
        title = parts[0].trim();
        author = parts[1].trim();
      }
    }
    // Try "Title by Author" pattern
    else if (cleanName.includes(' by ')) {
      const parts = cleanName.split(' by ');
      if (parts.length === 2) {
        title = parts[0].trim();
        author = parts[1].trim();
      }
    }
    // Try "Author - Title" pattern (less common)
    else if (cleanName.includes(' - ')) {
      const parts = cleanName.split(' - ');
      if (parts.length === 2) {
        // Heuristic: if first part looks like an author name (shorter, contains common name patterns)
        const firstPart = parts[0].trim();
        const secondPart = parts[1].trim();
        
        if (firstPart.length < secondPart.length && firstPart.split(' ').length <= 3) {
          author = firstPart;
          title = secondPart;
        } else {
          title = firstPart;
          author = secondPart;
        }
      }
    }
    // Try "Title (Author)" pattern
    else if (cleanName.includes('(') && cleanName.includes(')')) {
      const match = cleanName.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        title = match[1].trim();
        author = match[2].trim();
      }
    }
    
    return { title, author };
  }

  /**
   * Convert MP3 files to M4B using the improved conversion utility
   */
  private async convertMp3ToM4bImproved(tempDir: string, torrentName: string): Promise<string | null> {
    try {
      // Check if directory has MP3 files
      const hasMP3s = await hasMP3Files(tempDir);
      if (!hasMP3s) {
        console.log('🎵 No MP3 files found for conversion. That\'s disappointing. Like finding an empty lasagna pan.');
        return null;
      }

      console.log('🎵 Converting MP3 files to M4B... This will take longer than my afternoon nap, but it\'ll be worth it!');

      // Extract metadata from torrent name
      const metadata = this.extractMetadataFromName(torrentName);
      console.log('📖 Extracted metadata like a detective. I\'m basically Sherlock Holmes, but lazier:', metadata);

      // Use the improved converter
      const result = await convertMp3ToM4b(tempDir, {
        title: metadata.title,
        author: metadata.author,
        autoApprove: true // Always auto-approve for automated uploads
      });

      if (result.success && result.outputPath) {
        const durationMinutes = Math.round((result.duration || 0) / 1000 / 60);
        console.log(`✅ MP3 to M4B conversion successful! I'm more accomplished than Jon on his best day: ${result.outputPath}`);
        console.log(`⏱️  Conversion took: ${durationMinutes} minutes. That's ${durationMinutes} minutes I could have spent napping.`);
        return result.outputPath;
      } else {
        console.error(`❌ MP3 to M4B conversion failed. This is worse than a Monday morning: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error in MP3 to M4B conversion. I blame Nermal for being too distracting:', error);
      return null;
    }
  }

  /**
   * Convert ebooks to EPUB and MOBI formats
   */
  private async convertEbooksImproved(tempDir: string, torrentName: string): Promise<string[]> {
    try {
      // Check if directory has convertible ebooks
      const ebookCheck = await hasConvertibleEbooks(tempDir);
      if (!ebookCheck.hasConvertible) {
        console.log(`📚 No ebook conversion needed: ${ebookCheck.reason}`);
        return [];
      }

      console.log(`📚 Converting ebooks to EPUB + MOBI... This is more work than I usually do in a week!`);
      console.log(`Found ${ebookCheck.files.length} file(s) to convert: ${ebookCheck.reason}`);

      // Extract metadata from torrent name
      const metadata = this.extractMetadataFromName(torrentName);
      console.log('📖 Extracted metadata for ebook conversion:', metadata);

      const convertedFiles: string[] = [];

      // Convert each ebook file
      for (const sourceFile of ebookCheck.files) {
        const result = await convertEbook(sourceFile, {
          title: metadata.title,
          author: metadata.author,
          autoApprove: true
        });

        if (result.success) {
          const durationSeconds = Math.round((result.duration || 0) / 1000);
          console.log(`✅ Ebook conversion successful! Took ${durationSeconds} seconds.`);

          if (result.epubPath) {
            convertedFiles.push(result.epubPath);
            console.log(`  📗 EPUB: ${path.basename(result.epubPath)}`);
          }
          if (result.mobiPath) {
            convertedFiles.push(result.mobiPath);
            console.log(`  📘 MOBI: ${path.basename(result.mobiPath)}`);
          }
        } else {
          console.error(`❌ Ebook conversion failed: ${result.error}`);
        }
      }

      if (convertedFiles.length > 0) {
        console.log(`✅ Ebook conversion completed! Created ${convertedFiles.length} file(s).`);
      }

      return convertedFiles;
    } catch (error) {
      console.error('❌ Error in ebook conversion:', error);
      return [];
    }
  }

  /**
   * Analyze content type based on file extensions
   */
  private analyzeContentType(files: Array<{path: string, size: number}>): ContentTypeAnalysis {
    const audioExtensions = ['.mp3', '.m4a', '.m4b', '.flac', '.wav', '.aac'];
    const ebookExtensions = ['.epub', '.mobi', '.azw3', '.azw', '.pdf', '.txt', '.fb2'];
    
    const audioFiles: string[] = [];
    const ebookFiles: string[] = [];
    const otherFiles: string[] = [];
    let totalSize = 0;

    for (const file of files) {
      const ext = path.extname(file.path).toLowerCase();
      const fileName = path.basename(file.path);
      totalSize += file.size;

      if (audioExtensions.includes(ext)) {
        audioFiles.push(fileName);
      } else if (ebookExtensions.includes(ext)) {
        ebookFiles.push(fileName);
      } else {
        otherFiles.push(fileName);
      }
    }

    // Determine content type
    let type: 'audiobook' | 'ebook' | 'mixed' | 'unknown';
    
    if (audioFiles.length > 0 && ebookFiles.length > 0) {
      type = 'mixed';
    } else if (audioFiles.length > 0) {
      type = 'audiobook';
    } else if (ebookFiles.length > 0) {
      type = 'ebook';
    } else {
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

  /**
   * Clean up temporary directory
   */
  private async cleanupTemp(tempDir: string): Promise<void> {
    try {
      await execAsync(`rm -rf "${tempDir}"`);
      console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      console.error('❌ Error cleaning up temp directory. This mess is worse than Odie\'s drool:', error);
    }
  }

  /**
   * Upload torrent files to Google Drive
   */
  async uploadTorrent(
    torrentObject: TorrentObject, 
    options: UploadOptions = {}
  ): Promise<{
    success: boolean;
    folderId?: string;
    uploadedFiles: string[];
    convertedFile?: string;
    contentAnalysis?: ContentTypeAnalysis;
    error?: string;
  }> {
    const uploadedFiles: string[] = [];
    let folderId: string | undefined;
    let convertedFile: string | undefined;
    const { progressCallback } = options;

    try {
      // Clean the temp directory before starting any operations
      await this.cleanTempDirectory();

      // Check authentication
      if (!(await this.isAuthenticated())) {
        throw new Error('Cannot authenticate with Google Drive');
      }

      // Analyze content type
      const contentAnalysis = this.analyzeContentType(torrentObject.files);
      
      // Format file size
      const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      // Determine base path for files
      const basePath = torrentObject.savePath || '/mnt/nas/nzbget/nzb/completed/torrent';
      
      // Create folder in Google Drive if requested
      if (options.createSubfolder !== false) {
        // Create folder name with content type prefix
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
        
        // Log content analysis for debugging but don't send to user
        const analysisMessage = `Content analysis: ${contentAnalysis.type} (${contentAnalysis.audioFiles.length} audio, ${contentAnalysis.ebookFiles.length} ebook, ${contentAnalysis.otherFiles.length} other files, ${formatFileSize(contentAnalysis.totalSize)})`;
        console.log(analysisMessage);
        
        folderId = await this.createFolder(folderName, options.parentFolderId);
        const folderMessage = `Created folder: ${folderName} (ID: ${folderId})`;
        console.log(folderMessage);
        // Don't send this as a separate Discord message, just log it
      } else {
        // If not creating a subfolder, still send the analysis message
        const analysisMessage = `Content analysis: ${contentAnalysis.type} (${contentAnalysis.audioFiles.length} audio, ${contentAnalysis.ebookFiles.length} ebook, ${contentAnalysis.otherFiles.length} other files, ${formatFileSize(contentAnalysis.totalSize)})

📋 Copying files to temporary directory... Andrew Garfield would be proud of this level of dedication. To Lasagna`;
        console.log(analysisMessage);
        if (progressCallback) progressCallback(analysisMessage);
      }

      // Copy files to temp directory (no separate message needed)
      const copiedFiles = await this.copyFilesToTemp(torrentObject.files, basePath);

      if (copiedFiles.length === 0) {
        throw new Error('No files were successfully copied to temp directory');
      }

      const tempSessionDir = path.dirname(copiedFiles[0]);

      // Check if we should convert MP3 files
      const mp3Files = copiedFiles.filter(file => file.endsWith('.mp3'));
      let filesToUpload = copiedFiles;

      if (options.convertMp3ToM4b && mp3Files.length > 0) {
        const conversionStartMessage = 'Converting MP3 files to M4B (this will take like 30 minutes per half GB)...';
        console.log(conversionStartMessage);
        if (progressCallback) progressCallback(conversionStartMessage);
        const m4bFile = await this.convertMp3ToM4bImproved(tempSessionDir, torrentObject.name);

        if (m4bFile) {
          // Upload only the M4B file instead of individual MP3s
          filesToUpload = copiedFiles.filter(file => !file.endsWith('.mp3'));
          filesToUpload.push(m4bFile);
          convertedFile = path.basename(m4bFile);
        }
      }

      // Check if we should convert ebooks
      if (options.convertEbooks) {
        const ebookConversionMessage = 'Converting ebooks to EPUB + MOBI formats...';
        console.log(ebookConversionMessage);
        if (progressCallback) progressCallback(ebookConversionMessage);

        const convertedEbookFiles = await this.convertEbooksImproved(tempSessionDir, torrentObject.name);

        if (convertedEbookFiles.length > 0) {
          // Add converted ebooks to the upload list
          // Remove source PDFs if they were converted
          const pdfFiles = copiedFiles.filter(file => file.toLowerCase().endsWith('.pdf'));
          if (pdfFiles.length > 0) {
            filesToUpload = filesToUpload.filter(file => !file.toLowerCase().endsWith('.pdf'));
          }

          // Add all converted ebook files
          filesToUpload.push(...convertedEbookFiles);
        }
      }

      // Upload files to Google Drive
      const uploadStartMessage = `📤 Uploading ${filesToUpload.length} files to Google Drive...`;
      console.log(uploadStartMessage);
      if (progressCallback) progressCallback(uploadStartMessage);
      
      for (const filePath of filesToUpload) {
        const fileName = path.basename(filePath);
        
        // Check if file exists before attempting to upload
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File does not exist, skipping upload: ${filePath}`);
          continue;
        }
        
        try {
          const fileId = await this.uploadFile(filePath, fileName, folderId);
          uploadedFiles.push(fileName);
          console.log(`Uploaded: ${fileName} (ID: ${fileId})`);
          // Log progress for debugging
          if (uploadedFiles.length % 10 === 0 || uploadedFiles.length === filesToUpload.length) {
            console.log(`📤 Uploaded ${uploadedFiles.length}/${filesToUpload.length} files...`);
          }
        } catch (error) {
          console.error(`Failed to upload ${fileName}:`, error);
        }
      }

      // Clean up temp directory
      await this.cleanupTemp(tempSessionDir);

      return {
        success: true,
        folderId,
        uploadedFiles,
        convertedFile,
        contentAnalysis
      };

    } catch (error) {
      console.error('Error uploading torrent:', error);
      
      return {
        success: false,
        folderId,
        uploadedFiles,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's Google Drive info
   */
  async getUserInfo(): Promise<any> {
    try {
      const response = await this.drive.about.get({
        fields: 'user,storageQuota'
      });
      return response.data;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw new Error('Failed to get Google Drive user info');
    }
  }

  /**
   * List files in Google Drive (for debugging/verification)
   */
  async listFiles(parentId?: string, maxResults: number = 10): Promise<any[]> {
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
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error('Failed to list Google Drive files');
    }
  }
}
