
import axios from 'axios';
import { CommandInteraction, AttachmentBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { DownloadManager } from '../api/clients/downloadManagement';
import DelugeClientManager from '../api/clients/delugeClientManager';
import { checkForMp3AndPrompt, uploadTorrentToGDrive, handleUploadButtonInteraction } from './uploadUtils';
import { getPersonality } from './badjokes';
import { isUserPlayingGame, createPresenceBlockedMessage } from './presenceUtils';
import { getRandomWaitingMessage, getRandomCompletionMessage } from './garfieldMessages';
import { env } from '../config/env';

// Helper function to safely edit interaction replies
async function safeEditReply(interaction: CommandInteraction, content: any): Promise<boolean> {
  if (interaction.replied || interaction.deferred) {
    try {
      await interaction.editReply(content);
      return true;
    } catch (error: any) {
      if (error.code === 10062) {
        console.log('Interaction expired during editReply');
        return false;
      }
      if (error.code === 50027) {
        console.log('Invalid webhook token during editReply');
        return false;
      }
      throw error;
    }
  }
  console.log('Interaction not deferred, cannot edit reply');
  return false;
}

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

  // Check if interaction is still valid before deferring
  if (interaction.replied || interaction.deferred) {
    console.log('Interaction already replied or deferred');
    return;
  }

  try {
    // Defer reply immediately to prevent timeout
    await interaction.deferReply();
  } catch (error: any) {
    if (error.code === 10062) {
      console.log('Interaction expired before deferReply');
      return;
    }
    throw error;
  }

  // Check if the specified user is currently playing a game
  const isBlocked = await isUserPlayingGame(interaction.client);
  if (isBlocked) {
    await safeEditReply(interaction, createPresenceBlockedMessage());
    return;
  }

  const query = interaction.options.getString('query', true);
  const limit = interaction.options.getInteger('limit') || 10;
  const kindleEmail = interaction.options.getString('kindle_email') || undefined;
  
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
    await safeEditReply(interaction, `I found nothing. Zero. Zilch. Nada. ${getPersonality()}`);
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
    timestamp: Date.now(),
    kindleEmail
  });
  
  await safeEditReply(interaction, message);
  
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
    
    // Check if torrent is VIP and not free, then set as freeleech
    if (selectedTorrent.isVip && !selectedTorrent.isFree) {
      try {
        await axios.post('http://localhost:3000/api/mam/freeleech', {
          id: selectedTorrent.id,
          wedges: 1
        });
        await m.reply(`You picked **${selectedTorrent.title}**! ${getPersonality()} \n ✅ Successfully set torrent ${selectedTorrent.id} as freeleech!`);
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

          // Build buttons array
          const duplicateButtons: any[] = [
            {
              type: 2,
              style: 1,
              label: '☁️ Upload to Google Drive',
              custom_id: `duplicate_upload_${downloadResponse.data.torrentId}`
            }
          ];

          // Add "Send to Kindle" button if kindle email was provided and it's an ebook
          if (kindleEmail && bookType === 'ebook') {
            duplicateButtons.push({
              type: 2,
              style: 3,
              label: '📧 Send to Kindle',
              custom_id: `kindle_email_${downloadResponse.data.torrentId}_${Buffer.from(kindleEmail).toString('base64')}`
            });
          }

          // Add cancel button
          duplicateButtons.push({
            type: 2,
            style: 2,
            label: '❌ Cancel',
            custom_id: `duplicate_cancel_${downloadResponse.data.torrentId}`
          });

          // Send the button prompt as a follow-up message
          await m.channel.send({
            content: kindleEmail && bookType === 'ebook'
              ? 'What would you like to do with this ebook?'
              : 'Would you like to upload this torrent to Google Drive?',
            components: [
              {
                type: 1,
                components: duplicateButtons
              }
            ]
          });
        } else {
          duplicateMessage += `\n\n⏳ Torrent is still downloading. You can upload to Google Drive once it completes using \`/gdrive-upload\`. \n \n 🔄 Will automatically upload to Google Drive once download completes...`;
          await m.reply(duplicateMessage);
        }
      } else {
        await m.reply(`✅ Successfully added **${downloadResponse.data.torrentInfo?.name || selectedTorrent.title}** to the oven! \n \n🔄 Will automatically upload to Google Drive once it's done cooking... ${getPersonality()}`);
        


        // Start monitoring for completion and auto-upload
        setTimeout(async () => {
          await monitorAndAutoUpload(m, downloadResponse.data.torrentId, selectedTorrent.title, bookType, kindleEmail);
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
        await (channel as any).send(`⏰ ${bookType === 'audiobook' ? 'Audiobook' : 'E-book'} selection timed out for "${query}". Please try the command again. I NEED TO GET MORE LASAGNA!`);
      }
    }
  });
}

// Function to monitor torrent completion and auto-upload to Google Drive
async function monitorAndAutoUpload(message: any, torrentId: string, torrentName: string, bookType: 'audiobook' | 'ebook', kindleEmail?: string) {
  console.log(`Starting auto-upload monitoring for torrent: ${torrentId} (${torrentName}) [${bookType}]${kindleEmail ? ` with Kindle email: ${kindleEmail}` : ''}`);
  
  const maxAttempts = 120; // Monitor for up to 60 minutes (120 attempts * 30 seconds)
  let intervalId: NodeJS.Timeout | null = null;
  
  // Create a closure to capture the attempts variable
  const state = {
    attempts: 0,
    lastProgress: 0,
    hasNotifiedCompletion: false
  };
  
  const checkTorrent = async () => {
    try {
      console.log(`Auto-upload check attempt ${state.attempts + 1}/${maxAttempts} for torrent: ${torrentId}`);
      
      // Get torrent status first for better monitoring
      const clientManager = DelugeClientManager.getInstance();
      const delugeClient = await clientManager.getClient();
      const torrentStatus = await delugeClient.getTorrentStatus(torrentId);
      console.log(`Torrent ${torrentId} status: ${torrentStatus.state}, progress: ${torrentStatus.progress}%`);
      
      // If progress changed significantly, log it
      if (Math.abs(torrentStatus.progress - state.lastProgress) > 10) {
        console.log(`Progress update for ${torrentName}: ${torrentStatus.progress}%`);
        state.lastProgress = torrentStatus.progress;
      }
      
      // Break immediately if torrent is seeding with 100% progress, even if we've already processed it
      if (torrentStatus.progress === 100 && torrentStatus.state === 'Seeding') {
        console.log(`Torrent ${torrentId} is seeding with 100% progress. Stopping monitoring.`);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        // Only start upload process if we haven't already notified
        if (!state.hasNotifiedCompletion) {
          console.log(`Torrent ${torrentId} completed! Starting upload process.`);
          state.hasNotifiedCompletion = true;

          // Send completion alert
          await message.channel.send(`<@${message.author.id}> 🎉 **${torrentName}** is downloaded! ${getPersonality()}`);

          // If no Kindle email provided, automatically upload to Google Drive
          if (!kindleEmail || bookType !== 'ebook') {
            // Auto-upload flow: check for conversions then upload
            const conversionType = bookType === 'audiobook' ? 'MP3' : 'ebook formats';
            await message.channel.send(`<@${message.author.id}> Checking for ${conversionType} then uploading to drive...`);

            // Check for conversion based on book type
            if (bookType === 'audiobook') {
              // Check for MP3 conversion for audiobooks
              const hasMp3Files = await checkForMp3AndPrompt(torrentId, message, 'auto_upload');

              if (!hasMp3Files) {
                // If no MP3 files, proceed with upload immediately with progress updates
                const result = await uploadTorrentToGDrive(torrentId, false, false, message);

                // Send the final result message if it wasn't sent through the progressTarget
                if (result.success && result.message) {
                  try {
                    await message.channel.send(`<@${message.author.id}> ${result.message}`);
                    // Send Garfield comic after successful upload with download link
                    await sendRandomGarfieldComic(message.channel, message.author.id, 'completion');
                  } catch (error) {
                    console.error('Error sending final upload message:', error);
                  }
                }
              }
            } else if (bookType === 'ebook') {
              // For ebooks without kindle email, just upload directly
              const result = await uploadTorrentToGDrive(torrentId, false, false, message);

              // Send the final result message
              if (result.success && result.message) {
                try {
                  await message.channel.send(`<@${message.author.id}> ${result.message}`);
                  await sendRandomGarfieldComic(message.channel, message.author.id, 'completion');
                } catch (error) {
                  console.error('Error sending final upload message:', error);
                }
              }
            }
          } else {
            // Kindle email was provided - automatically send to Kindle first
            await message.channel.send(`<@${message.author.id}> 📧 Preparing to send ebook to ${kindleEmail}...`);

            // Import and call sendToKindle
            const { sendToKindle } = await import('./emailUtils');

            // Progress callback to send updates to Discord
            const progressCallback = async (progressMessage: string) => {
              try {
                await message.channel.send(`<@${message.author.id}> ${progressMessage}`);
              } catch (error) {
                console.error('Error sending progress message:', error);
              }
            };

            // Send to Kindle
            const result = await sendToKindle(torrentId, kindleEmail, progressCallback);

            // Send final result
            if (result.success) {
              await message.channel.send(`<@${message.author.id}> ${result.message}`);

              // Send Garfield comic after successful email
              await sendRandomGarfieldComic(message.channel, message.author.id, 'completion');

              // Now ask if they also want to upload to Google Drive
              await message.channel.send({
                content: 'Would you also like to upload this to Google Drive?',
                components: [
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 1,
                        label: '☁️ Upload to Google Drive',
                        custom_id: `auto_upload_${torrentId}`
                      },
                      {
                        type: 2,
                        style: 2,
                        label: '❌ No Thanks',
                        custom_id: `auto_cancel_${torrentId}`
                      }
                    ]
                  }
                ]
              });
            } else {
              await message.channel.send(`<@${message.author.id}> ${result.message}`);
            }
          }
        }
        
        return; // Exit the monitoring loop
        
      } else if (torrentStatus.state === 'Error') {
        console.error(`Torrent ${torrentId} is in Error state`);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        await message.channel.send(`<@${message.author.id}> ❌ **${torrentName}** failed to download. Check Deluge for errors.`);
        return;
      }
      
      // Increment attempts
      state.attempts++;
      
      if (state.attempts >= maxAttempts) {
        console.log(`Auto-upload monitoring timeout for torrent: ${torrentId}`);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        await message.channel.send(`<@${message.author.id}> ⏰ Auto-upload timeout for **${torrentName}**. The download may still be in progress. You can manually upload using \`/gdrive-upload\` once it completes.`);
      }
      
    } catch (error) {
      console.error(`Error checking torrent completion for ${torrentId}:`, error);
      state.attempts++;
      
      if (state.attempts >= maxAttempts) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        await message.channel.send(`<@${message.author.id}> ❌ Error monitoring **${torrentName}** for completion. You can manually upload using \`/gdrive-upload\` once it completes.`);
      }
    }
  };
  
  // Start monitoring immediately, then every 30 seconds
  await checkTorrent();
  intervalId = setInterval(checkTorrent, 30000);
}

// Function to handle auto-upload button interactions
export async function handleAutoUploadInteraction(interaction: any) {
  // Use the new unified upload button handler
  await handleUploadButtonInteraction(interaction, 'auto_upload', async (torrentId: string, convertMp3: boolean, convertEbook: boolean) => {
    // Custom upload logic for auto-upload (getebook/getaudiobook)
    const result = await uploadTorrentToGDrive(torrentId, convertMp3, convertEbook, interaction);

    // Always send completion as a new channel message (no interaction editing)
    await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
    // Send Garfield comic after successful upload with download link
    if (result.success) {
      await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');
    }
  });
}

// Function to handle duplicate torrent upload button interactions
export async function handleDuplicateUploadInteraction(interaction: any) {
  if (!interaction.isButton()) return;

  // Handle both underscore and colon separators
  const parts = interaction.customId.includes('_') 
    ? interaction.customId.split('_') 
    : interaction.customId.split(':');
  const [action, actionType, torrentId] = parts;

  if (action === 'duplicate') {
    if (actionType === 'upload') {
      await interaction.deferUpdate();

      try {
        // Instead of editing the original message, send a follow-up message
        // This avoids issues with interaction tokens expiring or too many buttons
        const clientManager = DelugeClientManager.getInstance();
        const delugeClient = await clientManager.getClient();
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
        
        await safeEditReply(interaction, { content: '🔄 Checking files for MP3 conversion...', components: [] });
        
        if (!hasMp3Files) {
          // If no MP3 files, proceed with upload and show progress
          const statusMessage = `🚀 Now uploading **${selectedTorrent.name}** to Google Drive. ${getPersonality()}`;
          await safeEditReply(interaction, { content: statusMessage });

          // Upload with progress updates
          const result = await uploadTorrentToGDrive(torrentId, false, false, interaction);
          
          // If the result message wasn't sent through the progressTarget, send it now
          if (result.success && result.message) {
            try {
              await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
              // Send Garfield comic after successful upload with download link
              await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');
            } catch (error) {
              console.error('Error sending final upload message:', error);
            }
          }
        }
        } else {
          await safeEditReply(interaction, { 
            content: `Torrent not found. It probably ran away to find a more interesting bot. One with more lasagna.\n\nTorrent ID: ${torrentId}`, 
            components: [] 
          });
        }

      } catch (error: any) {
        console.error('Error checking torrent files:', error);
        await safeEditReply(interaction, { 
          content: `❌ Error checking torrent files: ${error.message}`, 
          components: [] 
        });
      }
    } else if (actionType === 'cancel') {
      await interaction.deferUpdate();
      await safeEditReply(interaction, { 
        content: `❌ Upload cancelled.`, 
        components: [] 
      });
    } else if (actionType === 'convert' || actionType === 'no-convert') {
      // Use the unified upload button handler for conversion choices
      await handleUploadButtonInteraction(interaction, 'duplicate', async (torrentId: string, convertMp3: boolean, convertEbook: boolean) => {
        // Upload with progress updates
        const result = await uploadTorrentToGDrive(torrentId, convertMp3, convertEbook, interaction);

        // If the result message wasn't sent through the progressTarget, send it now
        if (result.success && result.message) {
          try {
            await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
            // Send Garfield comic after successful upload with download link
            await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');
          } catch (error) {
            console.error('Error sending final upload message:', error);
          }
        }
      });
    }
  }
}

// Function to handle "Send to Kindle" button interactions
export async function handleKindleEmailInteraction(interaction: any) {
  if (!interaction.isButton()) return;

  try {
    // Parse custom_id: kindle_email_{torrentId}_{base64EncodedEmail}
    const parts = interaction.customId.split('_');
    if (parts.length < 4) {
      throw new Error('Invalid button custom_id format');
    }

    const torrentId = parts[2];
    const encodedEmail = parts.slice(3).join('_'); // Handle emails that might have underscores
    const kindleEmail = Buffer.from(encodedEmail, 'base64').toString('utf-8');

    console.log(`Sending torrent ${torrentId} to Kindle email: ${kindleEmail}`);

    await interaction.deferUpdate();

    // Send a status message
    await interaction.channel?.send(`<@${interaction.user.id}> 📧 Preparing to send ebook to ${kindleEmail}...`);

    // Import the sendToKindle function
    const { sendToKindle } = await import('./emailUtils');

    // Progress callback to send updates to Discord
    const progressCallback = async (message: string) => {
      try {
        await interaction.channel?.send(`<@${interaction.user.id}> ${message}`);
      } catch (error) {
        console.error('Error sending progress message:', error);
      }
    };

    // Send to Kindle
    const result = await sendToKindle(torrentId, kindleEmail, progressCallback);

    // Send final result
    if (result.success) {
      await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);

      // Send Garfield comic after successful email
      await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');
    } else {
      await interaction.channel?.send(`<@${interaction.user.id}> ${result.message}`);
    }

    // Update the original button message to remove buttons
    await safeEditReply(interaction, {
      content: result.success
        ? `✅ Sent to ${kindleEmail}`
        : `❌ Failed to send to Kindle`,
      components: []
    });

  } catch (error: any) {
    console.error('Error handling Kindle email interaction:', error);
    await interaction.channel?.send(`<@${interaction.user.id}> ❌ Error sending to Kindle: ${error.message}`);
  }
}

/**
 * Gets a random Garfield comic (actually Heathcliff) from the configured comics directory
 * @returns Promise<AttachmentBuilder | null> - Discord attachment for the comic image, or null if none found
 */
export async function getRandomGarfieldComic(): Promise<AttachmentBuilder | null> {
  try {
    const comicsPath = env.COMIC_IMAGE_PATH;
    
    // Check if directory exists
    if (!fs.existsSync(comicsPath)) {
      console.log(`Comics directory not found: ${comicsPath}`);
      return null;
    }
    
    // Read directory and filter for JPG files
    const files = fs.readdirSync(comicsPath);
    const jpgFiles = files.filter(file => 
      file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')
    );
    
    if (jpgFiles.length === 0) {
      console.log(`No JPG files found in comics directory: ${comicsPath}`);
      return null;
    }
    
    // Select random comic
    const randomComic = jpgFiles[Math.floor(Math.random() * jpgFiles.length)];
    const comicPath = path.join(comicsPath, randomComic);
    
    // Create Discord attachment
    const attachment = new AttachmentBuilder(comicPath, { name: randomComic });
    
    return attachment;
  } catch (error) {
    console.error('Error getting random Garfield comic:', error);
    return null;
  }
}

/**
 * Sends a random Garfield comic (actually Heathcliff) to a Discord channel
 * @param channel - The Discord channel to send to
 * @param userId - Optional user ID to mention
 * @param messageType - Type of message: 'waiting' (while processing) or 'completion' (after done)
 */
export async function sendRandomGarfieldComic(channel: any, userId?: string, messageType: 'waiting' | 'completion' = 'completion'): Promise<void> {
  try {
    const comic = await getRandomGarfieldComic();
    
    if (!comic) {
      console.log('No Garfield comic available to send');
      return;
    }
    
    const mention = userId ? `<@${userId}> ` : '';
    const message = messageType === 'waiting' ? getRandomWaitingMessage() : getRandomCompletionMessage();
    
    await channel.send({ 
      content: `${mention}${message}`,
      files: [comic]
    });
  } catch (error) {
    console.error('Error sending Garfield comic:', error);
  }
}
