import axios from 'axios';
import { DownloadManager } from '../api/clients/downloadManagement';
import { DelugeClient } from '../api/clients/delugeClient';
import { env } from '../config/env';
import { analyzeContentType, formatFileSize } from './utils';

const delugeClient = new DelugeClient(env.DELUGE_URL, env.DELUGE_PASSWORD);

import { getRandomUploadJoke, getRandomConversionJoke } from './badjokes';

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
  convert: boolean = false,
  customMessage?: string,
  progressTarget?: any
): Promise<UploadResult> {
  try {
    // If we have a progress target, we'll do the upload directly with progress callbacks
    if (progressTarget) {
      return await uploadTorrentWithProgress(torrentId, convert, progressTarget);
    }

    // Fallback to the old API method for backward compatibility
    const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
      torrentId: torrentId,
      convertMp3ToM4b: convert
    });

    if (uploadResponse.data.success) {
      const downloadManager = new DownloadManager(delugeClient);
      const files = await downloadManager.getTorrentFiles(torrentId);
      const analysis = analyzeContentType(files);
      
      let successMessage = customMessage || `✅ ${getRandomUploadJoke()}\n\n`;
      successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files`;

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

      if (uploadResponse.data.convertedFile) {
        successMessage += `🎵 Converted to: ${uploadResponse.data.convertedFile}\n`;
      }

      if (uploadResponse.data.folderId) {
        successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n\n`;
        successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}\n\n`;
      }

      return {
        success: true,
        message: successMessage,
        folderId: uploadResponse.data.folderId,
        uploadedFiles: uploadResponse.data.uploadedFiles,
        convertedFile: uploadResponse.data.convertedFile
      };
    } else {
      return {
        success: false,
        message: `❌ Upload failed. ${getRandomUploadJoke()} This is worse than running out of lasagna.\n\nError: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`,
        uploadedFiles: uploadResponse.data.uploadedFiles,
        error: uploadResponse.data.error
      };
    }
  } catch (error: any) {
    console.error('Error uploading torrent:', error);
    return {
      success: false,
        message: `❌ Upload failed. ${getRandomUploadJoke()} This is worse than running out of lasagna.\n\nError: ${error.response?.data?.error || error.message}`,
      uploadedFiles: [],
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Upload torrent with real-time progress updates to Discord
 */
async function uploadTorrentWithProgress(
  torrentId: string,
  convert: boolean,
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
          await progressTarget.channel?.send(`<@${progressTarget.user.id}> ${message}`);
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
      convertMp3ToM4b: convert,
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

      // Send the Google Drive link as a separate message if we have a progress target
      if (result.folderId && progressTarget) {
        try {
          const linkMessage = `📂 [View Folder](https://drive.google.com/drive/folders/${result.folderId})\n📂 Folder ID: ${result.folderId}`;
          await progressTarget.channel?.send(`<@${progressTarget.user.id}> ${linkMessage}`);
        } catch (error) {
          console.error('Error sending Google Drive link message:', error);
          // If we can't send a separate message, include it in the main message
          successMessage += `\n📂 [View Folder](https://drive.google.com/drive/folders/${result.folderId})\n`;
          successMessage += `📂 Folder ID: ${result.folderId}`;
        }
      } else if (result.folderId) {
        // Fallback: include in main message if no progress target
        successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${result.folderId})\n`;
        successMessage += `📂 Folder ID: ${result.folderId}`;
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
 * Check if torrent has MP3 files and create conversion prompt
 */
export async function checkForMp3AndPrompt(
  torrentId: string,
  replyTarget: any,
  actionPrefix: string = 'upload'
): Promise<boolean> {
  try {
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
      return true;
      
      return true; // MP3s found, user prompted
    }
    
    return false; // No MP3s found
  } catch (error) {
    console.error('Error checking for MP3 files:', error);
    return false;
  }
}

/**
 * Create a status message for upload operations
 */
export function createUploadStatusMessage(torrentName: string, convert: boolean): string {
  const baseMessage = `🎉 ${getRandomUploadJoke()} Successfully added **${torrentName}** to Deluge! I'll automatically upload it to Google Drive faster than Odie chases squirrels.`;
  
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
  onUploadStart?: (torrentId: string, convert: boolean) => Promise<void>
): Promise<void> {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  if (!customId.startsWith(actionPrefix)) return;

  const parts = customId.split(':');
  if (parts.length < 3) return;

  let convert = false;
  let torrentId = '';

  if (parts[1] === 'convert') {
    convert = true;
    torrentId = parts.slice(2).join(':');
  } else if (parts[1] === 'no-convert') {
    convert = false;
    torrentId = parts.slice(2).join(':');
  } else {
    console.error(`Invalid button custom_id format: ${customId}`);
    return;
  }

  console.log(`Button interaction: actionPrefix=${actionPrefix}, convert=${convert}, torrentId=${torrentId}`);

  await interaction.deferUpdate();

  try {
    // Get torrent info for the status message - try multiple methods to find the torrent
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

    // Show status message
    const statusMessage = createUploadStatusMessage(selectedTorrent.name, convert);
    await interaction.editReply({ content: statusMessage, components: [] });

    // Call custom upload start handler if provided
    if (onUploadStart) {
      await onUploadStart(torrentId, convert);
    } else {
      // Default upload behavior
      const result = await uploadTorrentToGDrive(torrentId, convert);
      
      // Update the message with the result
      try {
        await interaction.editReply({ content: result.message, components: [] });
      } catch (editError: any) {
        if (editError.code === 50027) { // Invalid Webhook Token
          await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
        } else {
          throw editError;
        }
      }
    }

  } catch (error: any) {
    console.error('Error in upload button interaction:', error);
    const errorMessage = `❌ Upload failed. This is all Odie's fault. I just know it.\n\nError: ${error.message}`;
    
    try {
      await interaction.editReply({ content: errorMessage, components: [] });
    } catch (editError: any) {
      if (editError.code === 50027) { // Invalid Webhook Token
        await interaction.channel?.send(`<@${interaction.user.id}> ${errorMessage}`);
      } else {
        console.error('Failed to send error message:', editError);
      }
    }
  }
}
