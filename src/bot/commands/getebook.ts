import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { handleBookSearch } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('getebook')
  .setDescription('Searches for and downloads an e-book.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The search term (title or author).')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('search_title')
      .setDescription('Search in title field (default: true).'))
  .addBooleanOption(option =>
    option.setName('search_author')
      .setDescription('Search in author field (default: true).'))
  .addIntegerOption(option =>
    option.setName('limit')
      .setDescription('The maximum number of results to return (default: 10).'))
  .addStringOption(option =>
    option.setName('kindle_email')
      .setDescription('Optional: Your Kindle email address to send the ebook directly.')
      .setRequired(false));

export async function execute(interaction: CommandInteraction) {
  await handleBookSearch(interaction, 'ebook');
}
