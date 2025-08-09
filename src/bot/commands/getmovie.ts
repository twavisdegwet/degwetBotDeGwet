import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { NZBHydraClient } from '../../api/clients/nzbhydraClient';
import { SABnzbdClient } from '../../api/clients/sabnzbdClient';
import { Logger } from '../../utils/logger';

export const command = {
  data: new SlashCommandBuilder()
    .setName('getmovie')
    .setDescription('Search NZB indexers for a movie')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Movie title to search for')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('quality')
        .setDescription('Video quality preference')
        .addChoices(
          { name: '1080p', value: '1080p' },
          { name: '720p', value: '720p' },
          { name: '4K', value: '2160p' }
        ))
    .addIntegerOption(option =>
      option.setName('year')
        .setDescription('Release year')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    const hydra = new NZBHydraClient();
    const sabnzbd = new SABnzbdClient();
    const title = interaction.options.getString('title', true);
    const quality = interaction.options.getString('quality') ?? undefined;
    const year = interaction.options.getInteger('year') ?? undefined;

    try {
      const results = await hydra.searchMovies(title, year, quality);
      
      if (results.length === 0) {
        await interaction.editReply('No movie releases found matching your criteria.');
        return;
      }

      // Create embed with top 10 results
      const embed = new EmbedBuilder()
        .setTitle(`Movie Search Results for "${title}"`)
        .setColor(0x0099FF)
        .setTimestamp();

      results.slice(0, 10).forEach((result, index) => {
        embed.addFields({
          name: `🎬 ${index + 1}. ${result.title}`,
          value: `**Size:** ${(result.size / 1024 / 1024 / 1024).toFixed(2)}GB\n` +
                 `**Indexer:** ${result.indexer}\n` +
                 `**Quality:** ${result.downloadType}`
        });
      });

      // Create download buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nzb_download')
          .setLabel('Download NZB')
          .setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      // Handle button interaction
      const collector = message.createMessageComponentCollector({
        time: 15000
      });

      collector.on('collect', async i => {
        if (i.customId === 'nzb_download') {
          try {
            const nzbUrl = await hydra.getNzbUrl(results[0].guid);
            await sabnzbd.addNzb(nzbUrl, 'movies');
            await i.reply({ content: `✅ Added "${results[0].title}" to SABnzbd!`, ephemeral: true });
          } catch (error) {
            Logger.error('Download failed:', error);
            await i.reply({ content: '❌ Failed to add download', ephemeral: true });
          }
        }
      });

    } catch (error) {
      Logger.error('Movie search failed:', error);
      await interaction.editReply('Failed to perform movie search. Please try again later.');
    }
  }
};
