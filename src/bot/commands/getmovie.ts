import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { NZBHydraClient } from '../../api/clients/nzbhydraClient';
import { SABnzbdClient } from '../../api/clients/sabnzbdClient';
import { Logger } from '../../utils/logger';
import { isUserPlayingGame, createPresenceBlockedMessage } from '../presenceUtils';

export const data = new SlashCommandBuilder()
  .setName('getmovie')
  .setDescription('Search NZB indexers for a movie')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('Movie title to search for')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('year')
      .setDescription('Release year'));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    // Check if the specified user is currently playing a game
    const isBlocked = await isUserPlayingGame(interaction.client);
    if (isBlocked) {
      await interaction.editReply(createPresenceBlockedMessage());
      return;
    }
    
    const hydra = new NZBHydraClient();
    const sabnzbd = new SABnzbdClient();
    const title = interaction.options.getString('title', true);
    const year = interaction.options.getInteger('year') ?? undefined;

    try {
      const results = await hydra.searchMovies(title, year);
      
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
          value: `**Size:** ${(result.size / 1024 / 1024 / 1024).toFixed(2)}GB`
        });
      });

      // Create download select menu with top 10 results
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('movie_select')
        .setPlaceholder('Choose a movie to download')
        .addOptions(
          results.slice(0, 10).map((result, index) => {
            // Truncate title if too long for Discord's limit
            let displayName = `${index + 1}. ${result.title}`;
            if (displayName.length > 100) {
              displayName = displayName.substring(0, 97) + '...';
            }
            
            return new StringSelectMenuOptionBuilder()
              .setLabel(displayName)
              .setValue(result.guid)
              .setDescription(`${(result.size / 1024 / 1024 / 1024).toFixed(2)}GB`);
          })
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      // Handle select menu interaction
      const collector = message.createMessageComponentCollector({
        time: 60000 // Increased time to 1 minute
      });

      collector.on('collect', async (i: StringSelectMenuInteraction) => {
        if (i.customId === 'movie_select') {
          // Get the selected movie guid
          const selectedGuid = i.values[0];
          const selectedMovie = results.find(result => result.guid === selectedGuid);
          
          if (!selectedMovie) {
            await i.reply({ content: '❌ Selected movie not found', ephemeral: true });
            return;
          }

          try {
            const nzbUrl = await hydra.getNzbUrl(selectedGuid);
            await sabnzbd.addNzb(nzbUrl, 'movies');
            await i.reply({ content: `✅ Added "${selectedMovie.title}" to download list. There's no tracking on this- if it isn't in "the folder" in like 30 minutes then it probably failed and you should get a new one `, ephemeral: false });
            
            // Disable the select menu after selection
            const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
              .addComponents(selectMenu.setDisabled(true));
            
            await message.edit({
              embeds: [embed],
              components: [disabledRow]
            });
          } catch (error) {
            Logger.error('Download failed:', error);
            await i.reply({ content: '❌ Failed to add download', ephemeral: false });
          }
        }
      });

      // Handle collector end event
      collector.on('end', async () => {
        // Disable the select menu when collector ends
        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(selectMenu.setDisabled(true));
        
        try {
          await message.edit({
            embeds: [embed],
            components: [disabledRow]
          });
        } catch (error) {
          // Message might have been deleted, ignore error
          Logger.debug('Failed to disable select menu:', error);
        }
      });

    } catch (error) {
      Logger.error('Movie search failed:', error);
      await interaction.editReply('Failed to perform movie search. Please try again later.');
    }
  }
