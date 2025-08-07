import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { handleBookSearch } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('getaudiobook')
  .setDescription('Searches for and downloads an audiobook.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The search term (title, author, or narrator).')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('search_title')
      .setDescription('Search in title field (default: true).'))
  .addBooleanOption(option =>
    option.setName('search_author')
      .setDescription('Search in author field (default: true).'))
  .addBooleanOption(option =>
    option.setName('search_narrator')
      .setDescription('Search in narrator field (default: true).'))
  .addIntegerOption(option =>
    option.setName('limit')
      .setDescription('The maximum number of results to return (default: 10).'));

export async function execute(interaction: CommandInteraction) {
  await handleBookSearch(interaction, 'audiobook');
}
