import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DownloadManager } from '../../api/clients/downloadManagement';
import { DelugeClient } from '../../api/clients/delugeClient';
import { env } from '../../config/env';
import { checkForMp3AndPrompt, uploadTorrentToGDrive, handleUploadButtonInteraction } from '../uploadUtils';
import { getPersonality } from '../badjokes';

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
      await interaction.editReply(`I searched far and wide, even checked under the couch cushions, but I couldn't find any completed torrents matching "${query}". ${getPersonality()}`);
      return;
    }

    let message = `**I found some torrents matching "${query}"!** ${getPersonality()}\n\n`;
    message += torrents.slice(0, 10).map((t, i) => `${i + 1}. ${t.name}`).join('\n');

    if (torrents.length > 10) {
      message += `\n\n*Showing first 10 of ${torrents.length} torrents*`;
    }

    message += `\n\nPick a number to upload a torrent. ${getPersonality()}`;

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

      await m.reply(`You picked **${selectedTorrent.name}**! \n ${getPersonality()} \n going to throw this in the ol' torrent client`);

      // Check for MP3 files and prompt user with the new unified system
      const hasMp3Files = await checkForMp3AndPrompt(selectedTorrent.id, m, 'gdrive_upload');
      
      if (!hasMp3Files) {
        // If no MP3 files detected, proceed with upload without conversion
        const statusMessage = `🚀 Now uploading **${selectedTorrent.name}** to Google Drive. ${getPersonality()}`;
        await m.reply(statusMessage);
        
        // Upload with progress updates
        await uploadTorrentToGDrive(selectedTorrent.id, false, undefined, m);
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
    // Upload with progress updates - no need to store result as it handles messaging internally
    await uploadTorrentToGDrive(torrentId, convert, undefined, interaction);
  });
}
