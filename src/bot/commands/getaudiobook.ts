import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { handleBookSearch } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('getaudiobook')
  .setDescription('Searches for and downloads an audiobook.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The title of the audiobook to search for.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('author')
      .setDescription('The author of the audiobook.'))
  .addStringOption(option =>
    option.setName('format')
      .setDescription('The format of the audiobook (e.g., MP3, M4B).'))
  .addBooleanOption(option =>
    option.setName('freeleech')
      .setDescription('Whether to search for freeleech torrents only.'))
  .addIntegerOption(option =>
    option.setName('limit')
      .setDescription('The maximum number of results to return (default: 10).'));

export async function execute(interaction: CommandInteraction) {
  await handleBookSearch(interaction, 'audiobook');
}
