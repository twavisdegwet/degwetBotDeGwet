import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DownloadManager } from '../../api/clients/downloadManagement';
import { DelugeClient } from '../../api/clients/delugeClient';
import { env } from '../../config/env';
import axios from 'axios';
import { analyzeContentType, formatFileSize } from '../utils';

const delugeClient = new DelugeClient(env.DELUGE_URL, env.DELUGE_PASSWORD);

export const data = new SlashCommandBuilder()
    .setName('gdrive-upload')
    .setDescription('☁️ Upload a completed torrent to Google Drive')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Search term to find the torrent to upload')
        .setRequired(true));

export async function execute(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);

  try {
    const downloadManager = new DownloadManager(delugeClient);
    const torrents = await downloadManager.searchTorrents(query);

    if (torrents.length === 0) {
      await interaction.editReply(`I searched far and wide, even checked under the couch cushions, but I couldn't find any completed torrents matching "${query}". This is a sadder day than the day the lasagna ran out.`);
      return;
    }

    let message = `**I found some torrents matching "${query}"! I was hoping for lasagna recipes, but this is good too, I guess.**\n\n`;
    message += torrents.slice(0, 10).map((t, i) => `${i + 1}. ${t.name}`).join('\n');

    if (torrents.length > 10) {
      message += `\n\n*Showing first 10 of ${torrents.length} torrents*`;
    }

    message += `\n\nPick a number to upload a torrent. Don't just sit there like you've eaten too much lasagna.`;

    await interaction.editReply(message);

    const { Collection } = require('@discordjs/collection');
    if (!(interaction.client as any).uploadTorrentList) {
      (interaction.client as any).uploadTorrentList = new Collection();
    }
    (interaction.client as any).uploadTorrentList.set(interaction.user.id, {
      torrents: torrents.slice(0, 10),
      timestamp: Date.now()
    });

    const filter = (m: any) =>
      m.author.id === interaction.user.id &&
      /^\d+$/.test(m.content) &&
      parseInt(m.content) >= 1 &&
      parseInt(m.content) <= Math.min(torrents.length, 10);

    const collector = (interaction.channel as any).createMessageCollector({
      filter,
      time: 60000,
      max: 1
    });

    collector.on('collect', async (m: any) => {
      const selection = parseInt(m.content) - 1;
      const selectedTorrent = (interaction.client as any).uploadTorrentList.get(interaction.user.id).torrents[selection];

      const files = await downloadManager.getTorrentFiles(selectedTorrent.id);
      const analysis = analyzeContentType(files);

      // Check if there are MP3 files - if so, always prompt the user
      const hasMp3Files = analysis.audioFiles.some(file => file.toLowerCase().endsWith('.mp3'));
      
      if (hasMp3Files) {
        const contentType = analysis.type === 'audiobook' ? 'audiobook' : 'content with MP3 files';
        await m.reply({
          content: `🎵 This ${contentType} is full of MP3s, like a lasagna is full of cheese. I can convert them to a single M4B file, but it'll take a while. You could probably take a nap, wake up, and it still wouldn't be done. So, what's the plan?`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 1,
                  label: 'Yes, convert to M4B',
                  custom_id: `gdrive_upload_convert_${selectedTorrent.id}`
                },
                {
                  type: 2,
                  style: 2,
                  label: 'No, upload as is',
                  custom_id: `gdrive_upload_no_convert_${selectedTorrent.id}`
                }
              ]
            }
          ]
        });
        return;
      }
      
      // If no MP3 files detected, proceed with upload without conversion
      await uploadToGDrive(m, selectedTorrent, false);
    });
  } catch (error) {
    console.error('Error handling gdrive-upload command:', error);
    await interaction.editReply('I messed up. This is a disaster. A real Monday of an error. I bet Nermal is behind this.');
  }
}

export async function handleGDriveUploadInteraction(interaction: any) {
  if (!interaction.isButton()) return;

  const [action, ...params] = interaction.customId.split('_');

  if (action === 'gdrive' && params[0] === 'upload') {
    const convert = params[1] === 'convert';
    const torrentId = params[2];

    await interaction.deferUpdate();

    const downloadManager = new DownloadManager(delugeClient);
    const torrents = await downloadManager.listCompletedTorrents();
    const selectedTorrent = torrents.find(t => t.id === torrentId);

    if (selectedTorrent) {
      await interaction.editReply({ content: `You clicked a button! That's more effort than I've put in all day. And I'm a robot. Now I'm going to upload **${selectedTorrent.name}**. Don't rush me, I'm thinking about lasagna.`, components: [] });
      await uploadToGDrive(interaction, selectedTorrent, convert, true);
    } else {
      await interaction.editReply({ content: 'I couldn\'t find the torrent. It probably ran away to find a more interesting bot. One with more lasagna.', components: [] });
    }
  }
}

async function uploadToGDrive(replyTarget: any, torrent: { id: string, name: string }, convert: boolean, isButtonInteraction: boolean = false) {
  let statusMessage;
  
  if (isButtonInteraction) {
    // For button interactions that have been deferred, use editReply
    statusMessage = await replyTarget.editReply({ 
      content: `🚀 Okay, I'm uploading **${torrent.name}** to Google Drive. This is hard work. I need a nap. And a lasagna. But mostly a nap.${convert ? '\n🎵 I\'m also converting MP3s to M4B, so this might take a while. Like, a really long while.' : ''}`,
      components: []
    });
  } else {
    // For regular message replies
    statusMessage = await replyTarget.reply({ 
      content: `🚀 Okay, I'm uploading **${torrent.name}** to Google Drive. This is hard work. I need a nap. And a lasagna. But mostly a nap.${convert ? '\n🎵 I\'m also converting MP3s to M4B, so this might take a while. Like, a really long while.' : ''}`,
      fetchReply: true 
    });
  }

  try {
    const uploadResponse = await axios.post('http://localhost:3000/api/uploads/torrent', {
      torrentId: torrent.id,
      convertMp3ToM4b: convert
    });

    if (uploadResponse.data.success) {
      const downloadManager = new DownloadManager(delugeClient);
      const files = await downloadManager.getTorrentFiles(torrent.id);
      const analysis = analyzeContentType(files);
      let successMessage = `✅ Hooray! **${torrent.name}** is on Google Drive. That was almost as satisfying as a nap after a big meal. Almost.\n\n`;
      successMessage += `📁 I uploaded ${uploadResponse.data.uploadedFiles.length} files`;

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

      await statusMessage.edit({ content: successMessage, components: [] });
    } else {
      await statusMessage.edit({ content: `❌ The upload failed. I'm so depressed. I think I'll go eat a whole pan of lasagna to feel better. \n\nError: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`, components: [] });
    }
  } catch (error: any) {
    console.error('Error uploading torrent:', error);
    await statusMessage.edit({ content: `❌ The upload failed. I blame Odie. It's always Odie's fault. \n\nError: ${error.response?.data?.error || error.message}`, components: [] });
  }
}
