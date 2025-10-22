import { DownloadManager } from '../api/clients/downloadManagement';
import DelugeClientManager from '../api/clients/delugeClientManager';
import { env } from '../config/env';
import { analyzeContentType, formatFileSize } from './utils';
import { getRandomUploadJoke, getRandomConversionJoke } from './badjokes';

/**
 * Retry wrapper for upload operations with exponential backoff
 */
async function retryUploadOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
  operationName: string = 'upload operation'
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
      
      // Check if it's a network timeout/connection error that should be retried
      const isRetryableError = error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                              error.code === 'ECONNRESET' ||
                              error.code === 'ENOTFOUND' ||
                              error.message?.includes('timeout') ||
                              error.message?.includes('connect') ||
                              error.message?.includes('Authentication check failed') ||
                              error.message?.includes('Failed to create folder') ||
                              error.message?.includes('Failed to upload file');
      
      if (!isRetryableError) {
        // If it's not a retryable error (like "torrent not found"), don't retry
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export interface UploadResult {
  success: boolean;
  message: string;
  folderId?: string;
  uploadedFiles: string[];
  convertedFile?: string;
  error?: string;
}

/**
 * Unified upload function that handles all upload scenarios with real-time progress updates
 */
export async function uploadTorrentToGDrive(
  torrentId: string,
  convertMp3: boolean = false,
  convertEbook: boolean = false,
  progressTarget?: any
): Promise<UploadResult> {
  return await retryUploadOperation(
    () => uploadTorrentWithProgress(torrentId, convertMp3, convertEbook, progressTarget),
    3,
    2000,
    `Upload torrent ${torrentId}`
  );
}

/**
 * Upload torrent with real-time progress updates to Discord
 */
async function uploadTorrentWithProgress(
  torrentId: string,
  convertMp3: boolean,
  convertEbook: boolean,
  progressTarget: any
): Promise<UploadResult> {
  try {
    // Import the upload management client directly
    const { UploadManagementClient } = await import('../api/clients/uploadManagement');
    const path = await import('path');
    
    // Initialize upload client
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
      path.join(__dirname, '../../samplefiles/discord-468217-313c7eccba67.json');
    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1v7E_LESO6hE-vFFXcBE5WDjLocdbZ6nQ';
    
    const uploadClient = new UploadManagementClient(serviceAccountPath, driveFolderId);
    
    // Get torrent details
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    const torrents = await downloadManager.listCompletedTorrents();
    const selectedTorrent = torrents.find(t => t.id === torrentId);
    
    if (!selectedTorrent) {
      throw new Error('Torrent not found');
    }
    
    const torrentFiles = await downloadManager.getTorrentFiles(torrentId);
    
      // Create progress callback that sends only important messages to Discord
    const progressCallback = async (message: string) => {
      try {
        // Log all messages to console for debugging
        console.log(`Progress: ${message}`);
        
        // Only send key messages to Discord, not every progress update
        const shouldNotify = message.includes('Content analysis:') || 
                           message.includes('Converting MP3') || 
                           message.includes('Uploaded') || 
                           message.includes('Cleaned up temp directory');
        
        if (shouldNotify) {
          const userId = progressTarget.user?.id || progressTarget.author?.id;
          await progressTarget.channel?.send(`<@${userId}> ${message}`);
        }
      } catch (error) {
        console.error('Error sending progress message:', error);
      }
    };
    
    // Create torrent object for upload
    const torrentObject = {
      id: torrentId,
      name: selectedTorrent.name,
      files: torrentFiles,
      savePath: env.DOWNLOADS_DIRECTORY
    };
    
    // Upload with progress callback
    const result = await uploadClient.uploadTorrent(torrentObject, {
      convertMp3ToM4b: convertMp3,
      convertEbooks: convertEbook,
      createSubfolder: true,
      progressCallback
    });
    
    if (result.success) {
      const analysis = analyzeContentType(torrentFiles);
      
      let successMessage = `✅ ${getRandomUploadJoke()}\n\n`;
      successMessage += `📁 Uploaded ${result.uploadedFiles.length} files`;

      if (analysis.totalSize > 0) {
        successMessage += ` (${formatFileSize(analysis.totalSize)})`;
      }
      successMessage += '\n';

      const contentParts = [];
      if (analysis.audioFiles.length > 0) {
        contentParts.push(`${analysis.audioFiles.length} audio file${analysis.audioFiles.length > 1 ? 's' : ''}`);
      }
      if (analysis.ebookFiles.length > 0) {
        contentParts.push(`${analysis.ebookFiles.length} e-book file${analysis.ebookFiles.length > 1 ? 's' : ''}`);
      }
      if (analysis.otherFiles.length > 0) {
        contentParts.push(`${analysis.otherFiles.length} other file${analysis.otherFiles.length > 1 ? 's' : ''}`);
      }

      if (contentParts.length > 0) {
        successMessage += `${analysis.emoji} Content: ${contentParts.join(', ')}\n`;
      }

      if (result.convertedFile) {
        successMessage += `🎵 Converted to: ${result.convertedFile}\n`;
      }

      // Add Italian food emojis and download link to the main message
      if (result.folderId) {
        successMessage += `\n🍝🍕🧄🍞🐱🍝🍕🧄🍞🐱🍝🍕🧄🍞🐱\n📂 [DOWNLOAD AVAILABLE HERE](https://drive.google.com/drive/folders/${result.folderId})\n🍝🍕🧄🍞🐱🍝🍕🧄🍞🐱🍝🍕🧄🍞🐱`;
      }

      return {
        success: true,
        message: successMessage,
        folderId: result.folderId,
        uploadedFiles: result.uploadedFiles,
        convertedFile: result.convertedFile
      };
    } else {
      return {
        success: false,
        message: `❌ Upload failed. ${getRandomUploadJoke()} This is worse than running out of lasagna.\n\nError: ${result.error}\n\nPartially uploaded files: ${result.uploadedFiles.length}`,
        uploadedFiles: result.uploadedFiles,
        error: result.error
      };
    }
  } catch (error: any) {
    console.error('Error uploading torrent with progress:', error);
    return {
      success: false,
      message: `❌ Upload failed. I blame Nermal. It's always Nermal's fault.\n\nError: ${error.message}`,
      uploadedFiles: [],
      error: error.message
    };
  }
}

/**
 * Check if torrent has MP3 files and create conversion prompt with auto-convert on timeout
 */
export async function checkForMp3AndPrompt(
  torrentId: string,
  replyTarget: any,
  actionPrefix: string = 'upload'
): Promise<boolean> {
  try {
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    const files = await downloadManager.getTorrentFiles(torrentId);
    const analysis = analyzeContentType(files);
    const hasMp3Files = analysis.audioFiles.some(file => {
      const lowerFile = file.toLowerCase();
      return lowerFile.endsWith('.mp3') && !lowerFile.endsWith('.m4b');
    });

    if (hasMp3Files) {
      // Create a dedicated status message that will be updated
      const statusMessage = await replyTarget.channel.send('🔄 Checking files...');

      const promptMessage = {
        content: getRandomConversionJoke(),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: '🎵 Convert to M4B',
                custom_id: `${actionPrefix}:convert:${torrentId}`,
                emoji: { name: '🎵' }
              },
              {
                type: 2,
                style: 2,
                label: '📁 Upload As-Is',
                custom_id: `${actionPrefix}:no-convert:${torrentId}`,
                emoji: { name: '📁' }
              }
            ]
          }
        ]
      };

      // Edit the status message with the actual prompt
      await statusMessage.edit(promptMessage);

      // Create a collector to wait for button interaction with 60 second timeout
      const filter = (i: any) => {
        return (i.customId === `${actionPrefix}:convert:${torrentId}` ||
                i.customId === `${actionPrefix}:no-convert:${torrentId}`);
      };

      const collector = statusMessage.createMessageComponentCollector({
        filter,
        time: 60000, // 60 seconds timeout
        max: 1
      });

      collector.on('end', async (_collected: any, reason: string) => {
        if (reason === 'time') {
          // Timeout occurred - default to conversion
          console.log(`M4B conversion prompt timed out for torrent ${torrentId}, defaulting to conversion`);

          try {
            // Remove the buttons
            await statusMessage.edit({
              content: '⏰ **Conversion prompt timed out - defaulting to M4B conversion**\n\n🎵 Starting MP3 to M4B conversion... This will take about 30 minutes.',
              components: []
            });

            // Trigger the upload with conversion enabled
            const result = await uploadTorrentToGDrive(torrentId, true, false, replyTarget);

            // Send completion message
            const userId = replyTarget.user?.id || replyTarget.author?.id;
            if (userId && result.message) {
              await replyTarget.channel?.send(`<@${userId}> ${result.message}`);
            }
          } catch (error) {
            console.error('Error handling timeout conversion:', error);
            const userId = replyTarget.user?.id || replyTarget.author?.id;
            await replyTarget.channel?.send(`<@${userId}> ❌ Error starting conversion after timeout: ${error}`);
          }
        }
      });

      return true; // MP3s found, user prompted
    }

    return false; // No MP3s found
  } catch (error) {
    console.error('Error checking for MP3 files:', error);
    return false;
  }
}

/**
 * Check if torrent has convertible ebooks and create conversion prompt with auto-convert on timeout
 */
export async function checkForEbooksAndPrompt(
  torrentId: string,
  replyTarget: any,
  actionPrefix: string = 'upload'
): Promise<boolean> {
  try {
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    const files = await downloadManager.getTorrentFiles(torrentId);
    const analysis = analyzeContentType(files);

    // Check for convertible ebooks (PDF, or missing EPUB/MOBI)
    const hasPdf = analysis.ebookFiles.some(file => file.toLowerCase().endsWith('.pdf'));
    const hasEpub = analysis.ebookFiles.some(file => file.toLowerCase().endsWith('.epub'));
    const hasMobi = analysis.ebookFiles.some(file => file.toLowerCase().endsWith('.mobi'));

    // Determine if conversion would be beneficial
    const shouldConvert = hasPdf || (hasEpub && !hasMobi) || (!hasEpub && hasMobi);

    if (shouldConvert && analysis.ebookFiles.length > 0) {
      // Create a dedicated status message that will be updated
      const statusMessage = await replyTarget.channel.send('🔄 Checking ebook files...');

      let promptContent = '📚 Found ebook files that could be converted!\n\n';
      if (hasPdf) {
        promptContent += '• PDF file(s) detected - can convert to EPUB + MOBI\n';
      }
      if (hasEpub && !hasMobi) {
        promptContent += '• EPUB file(s) found but no MOBI - can generate MOBI version\n';
      }
      if (hasMobi && !hasEpub) {
        promptContent += '• MOBI file(s) found but no EPUB - can generate EPUB version\n';
      }
      promptContent += '\nWould you like to convert to both EPUB and MOBI formats?';

      const promptMessage = {
        content: promptContent,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: '📚 Convert to EPUB + MOBI',
                custom_id: `${actionPrefix}:convert-ebook:${torrentId}`,
                emoji: { name: '📚' }
              },
              {
                type: 2,
                style: 2,
                label: '📁 Upload As-Is',
                custom_id: `${actionPrefix}:no-convert-ebook:${torrentId}`,
                emoji: { name: '📁' }
              }
            ]
          }
        ]
      };

      // Edit the status message with the actual prompt
      await statusMessage.edit(promptMessage);

      // Create a collector to wait for button interaction with 60 second timeout
      const filter = (i: any) => {
        return (i.customId === `${actionPrefix}:convert-ebook:${torrentId}` ||
                i.customId === `${actionPrefix}:no-convert-ebook:${torrentId}`);
      };

      const collector = statusMessage.createMessageComponentCollector({
        filter,
        time: 60000, // 60 seconds timeout
        max: 1
      });

      collector.on('end', async (_collected: any, reason: string) => {
        if (reason === 'time') {
          // Timeout occurred - default to conversion
          console.log(`Ebook conversion prompt timed out for torrent ${torrentId}, defaulting to conversion`);

          try {
            // Remove the buttons
            await statusMessage.edit({
              content: '⏰ **Conversion prompt timed out - defaulting to ebook conversion**\n\n📚 Starting ebook conversion to EPUB + MOBI... This may take a few minutes.',
              components: []
            });

            // Trigger the upload with ebook conversion enabled
            const result = await uploadTorrentToGDrive(torrentId, false, true, replyTarget);

            // Send completion message
            const userId = replyTarget.user?.id || replyTarget.author?.id;
            if (userId && result.message) {
              await replyTarget.channel?.send(`<@${userId}> ${result.message}`);
            }
          } catch (error) {
            console.error('Error handling timeout ebook conversion:', error);
            const userId = replyTarget.user?.id || replyTarget.author?.id;
            await replyTarget.channel?.send(`<@${userId}> ❌ Error starting ebook conversion after timeout: ${error}`);
          }
        }
      });

      return true; // Convertible ebooks found, user prompted
    }

    return false; // No convertible ebooks found
  } catch (error) {
    console.error('Error checking for convertible ebooks:', error);
    return false;
  }
}

/**
 * Create a status message for upload operations
 */
export function createUploadStatusMessage(torrentName: string, convert: boolean): string {
  const baseMessage = `🚀 **${torrentName}** is ready! Starting upload to Google Drive... ${getRandomUploadJoke()}`;

  if (convert) {
    return `${baseMessage}\n\n🎵 Converting MP3s to M4B... This will take about 30 minutes. ${getRandomConversionJoke()}`;
  }

  return `${baseMessage}\n\n🔄 Upload will start automatically when download completes...`;
}

/**
 * Handle button interactions for upload operations
 */
export async function handleUploadButtonInteraction(
  interaction: any,
  actionPrefix: string,
  onUploadStart?: (torrentId: string, convertMp3: boolean, convertEbook: boolean) => Promise<void>
): Promise<void> {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  if (!customId.startsWith(actionPrefix)) return;

  const parts = customId.split(':');
  if (parts.length < 3) return;

  let convertMp3 = false;
  let convertEbook = false;
  let torrentId = '';

  if (parts[1] === 'convert') {
    convertMp3 = true;
    torrentId = parts.slice(2).join(':');
  } else if (parts[1] === 'no-convert') {
    convertMp3 = false;
    torrentId = parts.slice(2).join(':');
  } else if (parts[1] === 'convert-ebook') {
    // Ebook conversion requested
    convertEbook = true;
    torrentId = parts.slice(2).join(':');
  } else if (parts[1] === 'no-convert-ebook') {
    // No ebook conversion requested
    convertEbook = false;
    torrentId = parts.slice(2).join(':');
  } else {
    console.error(`Invalid button custom_id format: ${customId}`);
    return;
  }

  console.log(`Button interaction: actionPrefix=${actionPrefix}, convertMp3=${convertMp3}, convertEbook=${convertEbook}, torrentId=${torrentId}`);

  await interaction.deferUpdate();

  try {
    // Get torrent info for the status message - try multiple methods to find the torrent
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    
    // First try to get the torrent info directly by ID
    let selectedTorrent;
    try {
      const torrentInfo = await downloadManager.getTorrentInfo(torrentId);
      if (torrentInfo && torrentInfo.name) {
        selectedTorrent = { id: torrentId, name: torrentInfo.name };
        console.log(`Found torrent by direct lookup: ${selectedTorrent.name}`);
      }
    } catch (directError: any) {
      console.log(`Direct torrent lookup failed: ${directError.message}`);
    }
    
    // If direct lookup failed, search through completed torrents
    if (!selectedTorrent) {
      const torrents = await downloadManager.listCompletedTorrents();
      selectedTorrent = torrents.find((t: {id: string, name: string}) => t.id.toLowerCase() === torrentId.toLowerCase());
      
      if (selectedTorrent) {
        console.log(`Found torrent in completed list: ${selectedTorrent.name}`);
      } else {
        console.log(`Torrent not found in completed list. Available torrents:`, torrents.map((t: {id: string, name: string}) => ({ id: t.id, name: t.name })));
      }
    }
    
    if (!selectedTorrent) {
      console.error(`Torrent not found anywhere: ${torrentId}`);
      await interaction.editReply({
        content: `Torrent not found. It probably ran away to find a more interesting bot. One with more lasagna.\n\nTorrent ID: ${torrentId}`,
        components: []
      });
      return;
    }

    // Show status message using interaction (this is immediate, so safe)
    let statusMessage: string;
    if (convertEbook) {
      statusMessage = `🚀 **${selectedTorrent.name}** is ready! Starting ebook conversion and upload to Google Drive... ${getRandomUploadJoke()}\n\n📚 Converting to EPUB + MOBI... This may take a few minutes.`;
    } else if (convertMp3) {
      statusMessage = createUploadStatusMessage(selectedTorrent.name, true);
    } else {
      statusMessage = createUploadStatusMessage(selectedTorrent.name, false);
    }
    await interaction.editReply({ content: statusMessage, components: [] });

    // Call custom upload start handler if provided (they handle their own completion messages)
    if (onUploadStart) {
      await onUploadStart(torrentId, convertMp3, convertEbook);
    } else {
      // Default upload behavior - send completion as new channel message
      const result = await uploadTorrentToGDrive(torrentId, convertMp3, convertEbook);
      await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
    }

  } catch (error: any) {
    console.error('Error in upload button interaction:', error);
    const errorMessage = `❌ Upload failed. This is all Odie's fault. I just know it.\n\nError: ${error.message}`;
    
    // Always send error as new channel message (no interaction editing)
    await interaction.channel?.send(`<@${interaction.user.id}> ${errorMessage}`);
  }
}
