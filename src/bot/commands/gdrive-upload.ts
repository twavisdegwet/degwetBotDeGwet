import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DownloadManager } from '../../api/clients/downloadManagement';
import { DelugeClient } from '../../api/clients/delugeClient';
import { env } from '../../config/env';
import { checkForMp3AndPrompt, uploadTorrentToGDrive, handleUploadButtonInteraction } from '../uploadUtils';

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

      // Check for MP3 files and prompt user with the new unified system
      const hasMp3Files = await checkForMp3AndPrompt(selectedTorrent.id, m, 'gdrive_upload');
      
      if (!hasMp3Files) {
        // If no MP3 files detected, proceed with upload without conversion
        await uploadToGDrive(m, selectedTorrent, false);
      }
    });
  } catch (error) {
    console.error('Error handling gdrive-upload command:', error);
    await interaction.editReply('I messed up. This is a disaster. A real Monday of an error. I bet Nermal is behind this.');
  }
}

export async function handleGDriveUploadInteraction(interaction: any) {
  // Use the new unified upload button handler
  await handleUploadButtonInteraction(interaction, 'gdrive_upload', async (torrentId: string, convert: boolean) => {
    // Custom upload logic for gdrive-upload command with progress updates
    const result = await uploadTorrentToGDrive(torrentId, convert, undefined, interaction);
    
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

async function uploadToGDrive(replyTarget: any, torrent: { id: string, name: string }, convert: boolean, isButtonInteraction: boolean = false) {
  // Use the new unified upload system with progress updates
  const result = await uploadTorrentToGDrive(torrent.id, convert, undefined, replyTarget);
  
  if (isButtonInteraction) {
    // For button interactions that have been deferred, use editReply
    await replyTarget.editReply({ content: result.message, components: [] });
  } else {
    // For regular message replies
    await replyTarget.reply({ content: result.message, fetchReply: true });
  }
}
