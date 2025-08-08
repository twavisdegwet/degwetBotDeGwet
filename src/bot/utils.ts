
import axios from 'axios';
import { CommandInteraction } from 'discord.js';
import { DownloadManager } from '../api/clients/downloadManagement';
import { DelugeClient } from '../api/clients/delugeClient';
import { env } from '../config/env';
import { checkForMp3AndPrompt, uploadTorrentToGDrive, handleUploadButtonInteraction } from './uploadUtils';
import { getPersonality } from './badjokes';

const delugeClient = new DelugeClient(env.DELUGE_URL, env.DELUGE_PASSWORD);

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Helper function to analyze content type based on file extensions
export function analyzeContentType(files: Array<{path: string, size: number}>): {
  type: 'audiobook' | 'ebook' | 'mixed' | 'unknown';
  audioFiles: string[];
  ebookFiles: string[];
  otherFiles: string[];
  totalSize: number;
  emoji: string;
  label: string;
} {
  const audioExtensions = ['.mp3', '.m4a', '.m4b', '.flac', '.wav', '.aac'];
  const ebookExtensions = ['.epub', '.mobi', '.azw3', '.azw', '.pdf', '.txt', '.fb2'];
  
  const audioFiles: string[] = [];
  const ebookFiles: string[] = [];
  const otherFiles: string[] = [];
  let totalSize = 0;

  for (const file of files) {
    const ext = require('path').extname(file.path).toLowerCase();
    const fileName = require('path').basename(file.path);
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
  let emoji: string;
  let label: string;
  
  if (audioFiles.length > 0 && ebookFiles.length > 0) {
    type = 'mixed';
    emoji = '📚';
    label = '[Mixed Media]';
  } else if (audioFiles.length > 0) {
    type = 'audiobook';
    emoji = '🎵';
    label = '[Audiobook]';
  } else if (ebookFiles.length > 0) {
    type = 'ebook';
    emoji = '📖';
    label = '[E-book]';
  } else {
    type = 'unknown';
    emoji = '📁';
    label = '';
  }

  return {
    type,
    audioFiles,
    ebookFiles,
    otherFiles,
    totalSize,
    emoji,
    label
  };
}


// Shared function for book search logic
export async function handleBookSearch(interaction: CommandInteraction, bookType: 'audiobook' | 'ebook') {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  
  const query = interaction.options.getString('query', true);
  const limit = interaction.options.getInteger('limit') || 10;
  
  // Get search field options (default to true if not specified)
  const searchTitle = interaction.options.getBoolean('search_title') ?? true;
  const searchAuthor = interaction.options.getBoolean('search_author') ?? true;
  const searchNarrator = bookType === 'audiobook' ? (interaction.options.getBoolean('search_narrator') ?? true) : false;
  
  // Build srchIn array based on selected search fields
  const srchInFields: string[] = [];
  if (searchTitle) srchInFields.push('title');
  if (searchAuthor) srchInFields.push('author');
  if (searchNarrator && bookType === 'audiobook') srchInFields.push('narrator');
  
  // Build search parameters matching the MAM URL structure
  const searchParams: any = {
    text: query,
    perpage: limit,
    srchIn: srchInFields.length > 0 ? srchInFields : ['title', 'author'],
    searchType: 'all',
    searchIn: 'torrents'
  };
  
  // Set categories based on book type
  if (bookType === 'audiobook') {
    // Audiobook categories
    searchParams.cat = [
      '39', '49', '50', '83', '51', '97', '40', '41', '106', '42', '52', '98', 
      '54', '55', '43', '99', '84', '44', '56', '45', '57', '85', '87', '119', 
      '88', '58', '59', '46', '47', '53', '89', '100', '108', '48', '111'
    ];
  } else {
    // E-book categories - using exact categories from MAM web UI
    searchParams.cat = [
      '60', '71', '72', '90', '61', '73', '101', '62', '63', '107', '64', '74', 
      '102', '76', '77', '65', '103', '115', '91', '66', '78', '67', '79', '80', 
      '92', '118', '94', '120', '95', '81', '82', '68', '69', '75', '96', '104', 
      '109', '70', '112'
    ];
  }
  
  // Add additional MAM search parameters to match the URL structure
  searchParams.browseFlagsHideVsShow = 0;
  searchParams.minSize = 0;
  searchParams.maxSize = 0;
  searchParams.unit = 1;
  searchParams.minSeeders = 0;
  searchParams.maxSeeders = 0;
  searchParams.minLeechers = 0;
  searchParams.maxLeechers = 0;
  searchParams.minSnatched = 0;
  searchParams.maxSnatched = 0;
  searchParams.sortType = 'default';
  searchParams.startNumber = 0;
  
  // Call our API
  const response = await axios.post('http://localhost:3000/api/mam/search', searchParams);
  
  const results = response.data.results;

  // Sort results by seeders in descending order
  results.sort((a: any, b: any) => b.seeders - a.seeders);
  
  if (results.length === 0) {
    await interaction.editReply(`I found nothing. Zero. Zilch. Nada. ${getPersonality()}`);
    return;
  }
  
  // Format results for Discord with numbered selections
  let message = `${getPersonality()} Here are the results for "${query}":\n\n`;
  message += `Pick a book by typing its number. Don't take too long, or I'll eat all the lasagna.\n\n`;
  
  // Add search field information
  const searchFields = [];
  if (searchTitle) searchFields.push('Title');
  if (searchAuthor) searchFields.push('Author');
  if (searchNarrator && bookType === 'audiobook') searchFields.push('Narrator');
  
  if (searchFields.length > 0) {
    message += `*Searching in: ${searchFields.join(', ')}*\n\n`;
  }
  
  results.slice(0, 5).forEach((torrent: any, index: number) => {
    message += `**${index + 1}.** ${torrent.title}\n`;
    
    // Add author if available
    if (torrent.author) {
      message += `   ✍️ ${torrent.author}\n`;
    }
    
    // Add narrator if available (for audiobooks)
    if (torrent.narrator && bookType === 'audiobook') {
      message += `   🎙️ ${torrent.narrator}\n`;
    }
    
    // Add series if available
    if (torrent.series) {
      message += `   📚 ${torrent.series}\n`;
    }
    
    message += `   📁 ${torrent.catname} | 💾 ${torrent.size} | 🌱 ${torrent.seeders} seeders\n`;
    message += `   🆔 ID: ${torrent.id} | Free: ${torrent.isFree ? '✅' : '❌'} | VIP: ${torrent.isVip ? '✅' : '❌'}\n`;
    
    // Add format if available
    if (torrent.filetype) {
      message += `   📄 Format: ${torrent.filetype.toUpperCase()}\n`;
    }
    
    message += `\n`;
  });
  
  if (results.length > 5) {
    message += `... and ${results.length - 5} more results`;
  }
  
  // Store results in a collection for later retrieval
  const { Collection } = require('@discordjs/collection');
  if (!(interaction.client as any).bookSearchResults) {
    (interaction.client as any).bookSearchResults = new Collection();
  }
  
  (interaction.client as any).bookSearchResults.set(interaction.user.id, {
    results: results.slice(0, 5),
    query,
    timestamp: Date.now()
  });
  
  await interaction.editReply(message);
  
  // Listen for user selection
  const filter = (m: any) => m.author.id === interaction.user.id && /^\d+$/.test(m.content) && parseInt(m.content) <= results.length && parseInt(m.content) > 0;
  
  const collector = (interaction.channel as any).createMessageCollector({ 
    filter, 
    time: 60000, // 1 minute
    max: 1 
  });
  
  collector.on('collect', async (m: any) => {
    const selection = parseInt(m.content) - 1;
    const selectedTorrent = results[selection];
    
    // Acknowledge selection
    await m.reply(`You picked **${selectedTorrent.title}**! ${getPersonality()}`);
    
    // Check if torrent is VIP and not free, then set as freeleech
    if (selectedTorrent.isVip && !selectedTorrent.isFree) {
      try {
        await axios.post('http://localhost:3000/api/mam/freeleech', {
          id: selectedTorrent.id,
          wedges: 1
        });
        await m.reply(`✅ Successfully set torrent ${selectedTorrent.id} as freeleech!`);
      } catch (error: any) {
        await m.reply(`❌ Failed to set freeleech: ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Check for duplicates in Deluge
    try {
      const duplicateCheck = await axios.post('http://localhost:3000/api/mam/check-duplicate', {
        torrentId: selectedTorrent.id
      });
      
      if (duplicateCheck.data.isDuplicate) {
        await m.reply(`⚠️ This torrent already exists in Deluge:\n**${duplicateCheck.data.existingTorrent.name}**\nState: ${duplicateCheck.data.existingTorrent.state}\nProgress: ${duplicateCheck.data.existingTorrent.progress}%`);
        return;
      }
    } catch (error: any) {
      console.log('Duplicate check failed:', error);
      // Continue with download even if duplicate check fails
    }
    
    // Download the selected torrent
    try {
      const downloadResponse = await axios.post('http://localhost:3000/api/mam/download', {
        id: selectedTorrent.id.toString()
      });
      
      if (downloadResponse.data.isDuplicate) {
        const torrentInfo = downloadResponse.data.torrentInfo;
        let duplicateMessage = `⚠️ This torrent already exists in Deluge:\n**${torrentInfo.name}**\nState: ${torrentInfo.state}\nProgress: ${torrentInfo.progress}%`;
        
        // Check if it's ready for Google Drive upload
        if (downloadResponse.data.canUploadToGDrive) {
          duplicateMessage += `\n\n🚀 This torrent is completed and ready for Google Drive upload!`;
          
          // Send as a separate message instead of editing the original to avoid button interaction issues
          await m.reply(duplicateMessage);
          
          // Send the button prompt as a follow-up message
          await m.channel.send({
            content: 'Would you like to upload this torrent to Google Drive?',
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: '☁️ Upload to Google Drive',
                    custom_id: `duplicate_upload_${downloadResponse.data.torrentId}`
                  },
                  {
                    type: 2,
                    style: 2,
                    label: '❌ Cancel',
                    custom_id: `duplicate_cancel_${downloadResponse.data.torrentId}`
                  }
                ]
              }
            ]
          });
        } else {
          duplicateMessage += `\n\n⏳ Torrent is still downloading. You can upload to Google Drive once it completes using \`/gdrive-upload\`.`;
          await m.reply(duplicateMessage);
        }
      } else {
        await m.reply(`✅ Successfully added torrent to Deluge!\nID: ${downloadResponse.data.torrentId}\nName: ${downloadResponse.data.torrentInfo?.name || selectedTorrent.title}`);
        
        // Auto-upload to Google Drive after download completes
        await m.reply(`🔄 Will automatically upload to Google Drive once download completes...`);
        
        // Start monitoring for completion and auto-upload
        setTimeout(async () => {
          await monitorAndAutoUpload(m, downloadResponse.data.torrentId, selectedTorrent.title);
        }, 5000); // Wait 5 seconds before starting to monitor
      }
    } catch (error: any) {
      await m.reply(`❌ Failed to download: ${error.response?.data?.error || error.message}`);
    }
  });
  
  collector.on('end', async (_collected: any, reason: string) => {
    if (reason === 'time') {
      // Clean up stored results
      if ((interaction.client as any).bookSearchResults) {
        (interaction.client as any).bookSearchResults.delete(interaction.user.id);
      }
      
      // Send timeout message if no selection was made
      const channel = interaction.channel;
      if (channel) {
        await (channel as any).send(`⏰ ${bookType === 'audiobook' ? 'Audiobook' : 'E-book'} selection timed out for "${query}". Please try the command again.`);
      }
    }
  });
}

// Function to monitor torrent completion and auto-upload to Google Drive
async function monitorAndAutoUpload(message: any, torrentId: string, torrentName: string) {
  const maxAttempts = 60; // Monitor for up to 30 minutes (60 attempts * 30 seconds)
  let intervalId: NodeJS.Timeout | null = null;
  
  // Create a closure to capture the attempts variable
  const state = {
    attempts: 0
  };
  
  const checkTorrent = async () => {
    try {
      // Check if torrent is completed
      const downloadManager = new DownloadManager(delugeClient);
      const completedTorrents = await downloadManager.listCompletedTorrents();
      const isCompleted = completedTorrents.some(t => t.id === torrentId);
      
      if (isCompleted) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        // Start the upload process
        await message.reply(`🎉 **${torrentName}** is downloaded! ${getPersonality()}`);
        
        // Use the new unified upload system
        const hasMp3Files = await checkForMp3AndPrompt(torrentId, message, 'auto_upload');
        
        if (!hasMp3Files) {
          // If no MP3 files, proceed with upload
          const result = await uploadTorrentToGDrive(torrentId, false, 
            `✅ **${torrentName}** is on Google Drive! ${getPersonality()}\n\n`
          );
          await message.reply(result.message);
        }
        
      } else {
        // Increment attempts only if torrent is not completed
        state.attempts++;
        
        if (state.attempts >= maxAttempts) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          await message.reply(`⏰ Auto-upload timeout for **${torrentName}**. The download may still be in progress. You can manually upload using \`/gdrive-upload\` once it completes.`);
        }
      }
      
    } catch (error) {
      console.error('Error checking torrent completion:', error);
      state.attempts++;
      
      if (state.attempts >= maxAttempts) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        await message.reply(`❌ Error monitoring **${torrentName}** for completion. You can manually upload using \`/gdrive-upload\` once it completes.`);
      }
    }
  };
  
  intervalId = setInterval(checkTorrent, 30000); // Check every 30 seconds
}

// Function to handle auto-upload button interactions
export async function handleAutoUploadInteraction(interaction: any) {
  // Use the new unified upload button handler
  await handleUploadButtonInteraction(interaction, 'auto_upload', async (torrentId: string, convert: boolean) => {
    // Custom upload logic for auto-upload (getebook/getaudiobook)
    const result = await uploadTorrentToGDrive(torrentId, convert, 
      `✅ It's on Google Drive! ${getPersonality()}\n\n`
    );
    
    // Update the interaction with the result
    try {
      await interaction.editReply({ content: result.message, components: [] });
    } catch (editError: any) {
      if (editError.code === 50027) { // Invalid Webhook Token
        await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
      } else {
        throw editError;
      }
    }
  });
}

// Function to handle duplicate torrent upload button interactions
export async function handleDuplicateUploadInteraction(interaction: any) {
  if (!interaction.isButton()) return;

  const [action, actionType, torrentId] = interaction.customId.split('_');

  if (action === 'duplicate') {
    if (actionType === 'upload') {
      await interaction.deferUpdate();

      try {
        // Instead of editing the original message, send a follow-up message
        // This avoids issues with interaction tokens expiring or too many buttons
        const downloadManager = new DownloadManager(delugeClient);
        let selectedTorrent;
        
        try {
          const torrentInfo = await downloadManager.getTorrentInfo(torrentId);
          if (torrentInfo && torrentInfo.name) {
            selectedTorrent = { id: torrentId, name: torrentInfo.name };
          }
        } catch (directError: any) {
          const torrents = await downloadManager.listCompletedTorrents();
          selectedTorrent = torrents.find((t: {id: string, name: string}) => t.id === torrentId);
        }
        
        if (selectedTorrent) {
        // Send a follow-up message with the MP3 conversion prompt
        const hasMp3Files = await checkForMp3AndPrompt(torrentId, interaction, 'duplicate');
        
        await interaction.editReply({ content: '🔄 Checking files for MP3 conversion...', components: [] });
        
        if (!hasMp3Files) {
          // If no MP3 files, proceed with upload and show progress
          const statusMessage = `🚀 Now uploading **${selectedTorrent.name}** to Google Drive. ${getPersonality()}`;
          await interaction.editReply({ content: statusMessage });
          
          // Upload with progress updates
          const result = await uploadTorrentToGDrive(torrentId, false, undefined, interaction);
          
          // If the result message wasn't sent through the progressTarget, send it now
          if (result.success && result.message) {
            try {
              await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
            } catch (error) {
              console.error('Error sending final upload message:', error);
            }
          }
        }
        } else {
          await interaction.editReply({ 
            content: `Torrent not found. It probably ran away to find a more interesting bot. One with more lasagna.\n\nTorrent ID: ${torrentId}`, 
            components: [] 
          });
        }

      } catch (error: any) {
        console.error('Error checking torrent files:', error);
        await interaction.editReply({ 
          content: `❌ Error checking torrent files: ${error.message}`, 
          components: [] 
        });
      }
    } else if (actionType === 'cancel') {
      await interaction.deferUpdate();
      await interaction.editReply({ 
        content: `❌ Upload cancelled.`, 
        components: [] 
      });
    } else if (actionType === 'convert' || actionType === 'no-convert') {
      // Use the unified upload button handler for conversion choices
      await handleUploadButtonInteraction(interaction, 'duplicate', async (torrentId: string, convert: boolean) => {
        // Upload with progress updates
        const result = await uploadTorrentToGDrive(torrentId, convert, undefined, interaction);
        
        // If the result message wasn't sent through the progressTarget, send it now
        if (result.success && result.message) {
          try {
            await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
          } catch (error) {
            console.error('Error sending final upload message:', error);
          }
        }
      });
    }
  }
}
