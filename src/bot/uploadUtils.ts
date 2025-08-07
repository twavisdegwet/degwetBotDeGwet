import axios from 'axios';
import { DownloadManager } from '../api/clients/downloadManagement';
import { DelugeClient } from '../api/clients/delugeClient';
import { env } from '../config/env';
import { analyzeContentType, formatFileSize } from './utils';

const delugeClient = new DelugeClient(env.DELUGE_URL, env.DELUGE_PASSWORD);

// Garfield-themed jokes for upload operations
const GARFIELD_JOKES = [
  "This is harder than getting Odie to fetch the newspaper without eating it first.",
  "I'm working harder than a cat trying to open a can of tuna with no thumbs.",
  "This upload is taking longer than my afternoon nap. And that's saying something!",
  "I'd rather be eating lasagna, but someone has to do the work around here.",
  "This is more exhausting than dodging Nermal's attempts at being cute.",
  "Working on a Monday? This goes against everything I believe in.",
  "I'm putting more effort into this than Jon puts into his dating life.",
  "This is almost as satisfying as pushing Odie off the table. Almost.",
  "If uploads were lasagna, this would be a feast!",
  "I'm being more productive than Jon on his best day."
];

const MP3_CONVERSION_JOKES = [
  "🎵 This audiobook has more MP3s than I have complaints about Mondays. We can convert them to a single M4B file, but it'll take longer than my post-lasagna nap. What do you say?",
  "🎵 Found MP3 files! Converting them to M4B is like combining all the layers of a lasagna into one perfect bite. It takes time, but it's worth it. Should I do the magic?",
  "🎵 MP3s detected! I can merge them into an M4B file faster than Odie can drool on the carpet. Well, maybe not that fast, but I'll try. Convert them?",
  "🎵 These MP3 files are scattered like Odie's brain cells. I can organize them into a nice M4B file. It'll take a while - perfect time for a nap. Shall I proceed?",
  "🎵 MP3 conversion time! This is more exciting than watching Jon try to impress a date. And by exciting, I mean I'd rather be sleeping. Convert anyway?"
];

function getRandomJoke(): string {
  return GARFIELD_JOKES[Math.floor(Math.random() * GARFIELD_JOKES.length)];
}

function getRandomMp3Joke(): string {
  return MP3_CONVERSION_JOKES[Math.floor(Math.random() * MP3_CONVERSION_JOKES.length)];
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
 * Unified upload function that handles all upload scenarios
 */
export async function uploadTorrentToGDrive(
  torrentId: string, 
  convert: boolean = false,
  customMessage?: string
): Promise<UploadResult> {
  try {
    const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
      torrentId: torrentId,
      convertMp3ToM4b: convert
    });

    if (uploadResponse.data.success) {
      const downloadManager = new DownloadManager(delugeClient);
      const files = await downloadManager.getTorrentFiles(torrentId);
      const analysis = analyzeContentType(files);
      
      let successMessage = customMessage || `✅ ${getRandomJoke()}\n\n`;
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
        successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n`;
        successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}`;
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
        message: `❌ Upload failed. ${getRandomJoke()} This is worse than running out of lasagna.\n\nError: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`,
        uploadedFiles: uploadResponse.data.uploadedFiles,
        error: uploadResponse.data.error
      };
    }
  } catch (error: any) {
    console.error('Error uploading torrent:', error);
    return {
      success: false,
      message: `❌ Upload failed. I blame Nermal. It's always Nermal's fault.\n\nError: ${error.response?.data?.error || error.message}`,
      uploadedFiles: [],
      error: error.response?.data?.error || error.message
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
    const hasMp3Files = analysis.audioFiles.some(file => file.toLowerCase().endsWith('.mp3'));
    
    if (hasMp3Files) {
      await replyTarget.reply({
        content: getRandomMp3Joke(),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1, // Primary button (blue)
                label: '🎵 Yes, convert to M4B',
                custom_id: `${actionPrefix}_convert_${torrentId}`,
                emoji: { name: '🎵' }
              },
              {
                type: 2,
                style: 2, // Secondary button (gray)
                label: '📁 No, upload as-is',
                custom_id: `${actionPrefix}_no_convert_${torrentId}`,
                emoji: { name: '📁' }
              }
            ]
          }
        ]
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
 * Create a status message for upload operations
 */
export function createUploadStatusMessage(torrentName: string, convert: boolean): string {
  const baseMessage = `🚀 ${getRandomJoke()} Now uploading **${torrentName}** to Google Drive.`;
  
  if (convert) {
    return `${baseMessage}\n\n🎵 Converting MP3s to M4B... This will take longer than Jon's attempts at cooking. Grab some lasagna and wait.`;
  }
  
  return baseMessage;
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

  const parts = customId.split('_');
  if (parts.length < 3) return;

  const convert = parts[1] === 'convert';
  const torrentId = parts.slice(2).join('_'); // Handle torrent IDs with underscores

  await interaction.deferUpdate();

  try {
    // Get torrent info for the status message
    const downloadManager = new DownloadManager(delugeClient);
    const torrents = await downloadManager.listCompletedTorrents();
    const selectedTorrent = torrents.find(t => t.id === torrentId);
    
    if (!selectedTorrent) {
      await interaction.editReply({ 
        content: 'Torrent not found. It probably ran away to find a more interesting bot. One with more lasagna.', 
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
