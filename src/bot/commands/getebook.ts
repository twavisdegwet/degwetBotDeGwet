import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { handleBookSearch } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('getebook')
  .setDescription('Searches for and downloads an e-book.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The title of the e-book to search for.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('author')
      .setDescription('The author of the e-book.'))
  .addStringOption(option =>
    option.setName('format')
      .setDescription('The format of the e-book (e.g., EPUB, PDF).'))
  .addBooleanOption(option =>
    option.setName('freeleech')
      .setDescription('Whether to search for freeleech torrents only.'))
  .addIntegerOption(option =>
    option.setName('limit')
      .setDescription('The maximum number of results to return (default: 10).'));

export async function execute(interaction: CommandInteraction) {
  await handleBookSearch(interaction, 'ebook');
}
