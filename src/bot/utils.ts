
import axios from 'axios';
import { CommandInteraction } from 'discord.js';
import { DownloadManager } from '../api/clients/downloadManagement';
import { DelugeClient } from '../api/clients/delugeClient';
import { env } from '../config/env';

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
  const author = interaction.options.getString('author');
  const format = interaction.options.getString('format');
  const freeleech = interaction.options.getBoolean('freeleech') || false;
  const limit = interaction.options.getInteger('limit') || 10;
  
  // Build search parameters
  const searchParams: any = {
    text: query,
    perpage: limit,
    srchIn: ['title', 'author'], // Default to searching both title and author
    searchType: 'all'
  };
  
  // Add optional filters
  if (author) {
    // If author filter is specified, search only in author field
    searchParams.srchIn = ['author'];
  }
  
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
  
  if (format) {
    searchParams.filetype = format;
  }
  
  if (freeleech) {
    searchParams.searchType = 'fl';
  }
  
  // Call our API
  const response = await axios.post('http://localhost:3000/api/mam/search', searchParams);
  
  const results = response.data.results;

  // Sort results by seeders in descending order
  results.sort((a: any, b: any) => b.seeders - a.seeders);
  
  if (results.length === 0) {
    await interaction.editReply(`No ${bookType === 'audiobook' ? 'audiobooks' : 'e-books'} found matching your criteria.`);
    return;
  }
  
  // Format results for Discord with numbered selections
  const bookTypeName = bookType === 'audiobook' ? 'Audiobook' : 'E-Book';
  let message = `Wow, a ${bookTypeName} search! Did you know Garfield the cat and Andrew Garfield share a name? I bet Spider-Man likes lasagna too. Anyway, here are your results for "${query}":\n\n`;
  message += `Please select a book by typing its number:\n\n`;
  
  // Add filter information if any were applied
  const filters = [];
  if (author) filters.push(`Author: ${author}`);
  if (format) filters.push(`Format: ${format.toUpperCase()}`);
  if (freeleech) filters.push('Freeleech only');
  
  if (filters.length > 0) {
    message += `*Filters: ${filters.join(', ')}*\n\n`;
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
    await m.reply(`Great choice! You selected: **${selectedTorrent.title}**. That's a better choice than a Monday, am I right? Garfield would approve.`);
    
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
          
          await m.reply({
            content: duplicateMessage,
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
        await message.reply(`🎉 **${torrentName}** download completed! Checking for MP3 files...`);
        
        // Check if there are MP3 files and prompt user
        const downloadManager = new DownloadManager(delugeClient);
        const files = await downloadManager.getTorrentFiles(torrentId);
        const analysis = analyzeContentType(files);
        const hasMp3Files = analysis.audioFiles.some(file => file.toLowerCase().endsWith('.mp3'));
        
        console.log(`DEBUG: Torrent ${torrentId} analysis:`, {
          totalFiles: files.length,
          audioFiles: analysis.audioFiles.length,
          hasMp3Files,
          audioFileNames: analysis.audioFiles.slice(0, 5) // Show first 5 for debugging
        });
        
        if (hasMp3Files) {
          const contentType = analysis.type === 'audiobook' ? 'audiobook' : 'content with MP3 files';
          console.log(`DEBUG: Prompting user for MP3 conversion for torrent ${torrentId}`);
          await message.reply({
            content: `🎵 This ${contentType} contains MP3 files. Would you like to convert them to M4B audiobook format before uploading? **WARNING: This is like, a super long process. We're talking maybe 30 minutes or more. Garfield hates waiting, and so will you. But it'll be worth it. Probably.**`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: 'Yes, convert to M4B',
                    custom_id: `auto_upload_convert_${torrentId}`
                  },
                  {
                    type: 2,
                    style: 2,
                    label: 'No, upload as is',
                    custom_id: `auto_upload_no_convert_${torrentId}`
                  }
                ]
              }
            ]
          });
          return; // Wait for user interaction
        }
        
        // If no MP3 files, proceed with upload
        try {
          const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
            torrentId: torrentId,
            convertMp3ToM4b: false
          });

          if (uploadResponse.data.success) {
            let successMessage = `✅ **${torrentName}** automatically uploaded to Google Drive!\n\n`;
            successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files\n`;
            
            if (uploadResponse.data.convertedFile) {
              successMessage += `🎵 Converted to: ${uploadResponse.data.convertedFile}\n`;
            }
            
            if (uploadResponse.data.folderId) {
              successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n`;
              successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}`;
            }

            await message.reply(successMessage);
          } else {
            await message.reply(`❌ Auto-upload failed for **${torrentName}**: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`);
          }
        } catch (error: any) {
          console.error('Error in auto-upload:', error);
          await message.reply(`❌ Auto-upload failed for **${torrentName}**: ${error.response?.data?.error || error.message}`);
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
  if (!interaction.isButton()) return;

  const [action, upload, convertAction, torrentId] = interaction.customId.split('_');

  if (action === 'auto' && upload === 'upload') {
    const convert = convertAction === 'convert';

    await interaction.deferUpdate();

    try {
      const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
        torrentId: torrentId,
        convertMp3ToM4b: convert
      });

      if (uploadResponse.data.success) {
        let successMessage = `✅ Successfully uploaded to Google Drive!\n\n`;
        successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files`;
        
        if (convert && uploadResponse.data.convertedFile) {
          successMessage += `\n🎵 Converted to: ${uploadResponse.data.convertedFile}`;
        }
        
        if (uploadResponse.data.folderId) {
          successMessage += `\n📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})`;
          successMessage += `\n📂 Folder ID: ${uploadResponse.data.folderId}`;
        }

        await interaction.editReply({ content: successMessage, components: [] });
      } else {
        await interaction.editReply({ 
          content: `❌ Upload failed: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`, 
          components: [] 
        });
      }
    } catch (error: any) {
      console.error('Error uploading torrent:', error);
      await interaction.editReply({ 
        content: `❌ Upload failed: ${error.response?.data?.error || error.message}`, 
        components: [] 
      });
    }
  }
}

// Function to handle duplicate torrent upload button interactions
export async function handleDuplicateUploadInteraction(interaction: any) {
  if (!interaction.isButton()) return;

  const [action, actionType, torrentId] = interaction.customId.split('_');

  if (action === 'duplicate') {
    if (actionType === 'upload') {
      await interaction.deferUpdate();

      try {
        // Get torrent files to check for MP3s
        const downloadManager = new DownloadManager(delugeClient);
        const files = await downloadManager.getTorrentFiles(torrentId);
        const analysis = analyzeContentType(files);
        const hasMp3Files = analysis.audioFiles.some(file => file.toLowerCase().endsWith('.mp3'));

        if (hasMp3Files) {
          const contentType = analysis.type === 'audiobook' ? 'audiobook' : 'content with MP3 files';
          await interaction.editReply({
            content: `🎵 This ${contentType} contains MP3 files. Would you like to convert them to M4B audiobook format before uploading? **WARNING: This is like, a super long process. We're talking maybe 30 minutes or more. Garfield hates waiting, and so will you. But it'll be worth it. Probably.**`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: 'Yes, convert to M4B',
                    custom_id: `duplicate_convert_${torrentId}`
                  },
                  {
                    type: 2,
                    style: 2,
                    label: 'No, upload as is',
                    custom_id: `duplicate_no_convert_${torrentId}`
                  }
                ]
              }
            ]
          });
          return;
        }

        // If no MP3 files, proceed with upload
        await uploadDuplicateTorrent(interaction, torrentId, false);

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
    } else if (actionType === 'convert' || actionType === 'no') {
      // Handle MP3 conversion choice
      await interaction.deferUpdate();
      const convert = actionType === 'convert';
      await uploadDuplicateTorrent(interaction, torrentId, convert);
    }
  }
}

// Helper function to upload duplicate torrent
async function uploadDuplicateTorrent(interaction: any, torrentId: string, convert: boolean) {
  try {
    // Show status message immediately
    const statusMessage = convert 
      ? `🚀 Starting upload to Google Drive with MP3→M4B conversion...\n\n⏳ This may take a while (30+ minutes) depending on file size.`
      : `🚀 Starting upload to Google Drive...`;
    
    await interaction.editReply({ 
      content: statusMessage, 
      components: [] 
    });

    const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
      torrentId: torrentId,
      convertMp3ToM4b: convert
    });

    if (uploadResponse.data.success) {
      let successMessage = `✅ Successfully uploaded duplicate torrent to Google Drive!\n\n`;
      successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files`;
      
      if (convert && uploadResponse.data.convertedFile) {
        successMessage += `\n🎵 Converted to: ${uploadResponse.data.convertedFile}`;
      }
      
      if (uploadResponse.data.folderId) {
        successMessage += `\n📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})`;
        successMessage += `\n📂 Folder ID: ${uploadResponse.data.folderId}`;
      }

      // Try to edit the reply first, but if it fails (token expired), send a new message
      try {
        await interaction.editReply({ content: successMessage, components: [] });
      } catch (editError: any) {
        if (editError.code === 50027) { // Invalid Webhook Token
          // Token expired, send a new message to the channel instead
          await interaction.channel?.send(`<@${interaction.user.id}> ${successMessage}`);
        } else {
          throw editError;
        }
      }
    } else {
      const errorMessage = `❌ Upload failed: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`;
      
      try {
        await interaction.editReply({ 
          content: errorMessage, 
          components: [] 
        });
      } catch (editError: any) {
        if (editError.code === 50027) { // Invalid Webhook Token
          await interaction.channel?.send(`<@${interaction.user.id}> ${errorMessage}`);
        } else {
          throw editError;
        }
      }
    }
  } catch (error: any) {
    console.error('Error uploading duplicate torrent:', error);
    const errorMessage = `❌ Upload failed: ${error.response?.data?.error || error.message}`;
    
    try {
      await interaction.editReply({ 
        content: errorMessage, 
        components: [] 
      });
    } catch (editError: any) {
      if (editError.code === 50027) { // Invalid Webhook Token
        await interaction.channel?.send(`<@${interaction.user.id}> ${errorMessage}`);
      } else {
        console.error('Failed to send error message:', editError);
      }
    }
  }
}
