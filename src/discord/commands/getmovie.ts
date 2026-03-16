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
import { Logger } from '../../shared/logger';
import { isUserPlayingGame, createPresenceBlockedMessage } from '../presenceUtils';
import { sendRandomGarfieldComic } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('getmovie')
  .setDescription('Search NZB indexers for a movie')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('Movie title to search for')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const title = interaction.options.getString('title', true);
    
    console.log(`Movie search initiated: "${title}"`);
    
    await interaction.deferReply();
    
    // Check if the specified user is currently playing a game
    console.log('Checking user presence...');
    const isBlocked = await isUserPlayingGame(interaction.client);
    if (isBlocked) {
      console.log('User presence check blocked movie search');
      await interaction.editReply(createPresenceBlockedMessage());
      return;
    }
    console.log('User presence check passed');
    
    const hydra = new NZBHydraClient();
    const sabnzbd = new SABnzbdClient();

    try {
      const results = await hydra.searchMovies(title);
      
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
            // Acknowledge the interaction immediately to prevent timeout
            await i.deferReply();
            
            // Show attempting message first
            await i.editReply({ content: `🔄 Attempting to add "${selectedMovie.title}" to download list. Here's some reading material while I get that cooking...` });
            
            const nzbUrl = await hydra.getNzbUrl(selectedGuid);
            await sabnzbd.addNzb(nzbUrl, 'movies');
            
            // Send 5 Garfield comics as reading material
            for (let comicIndex = 0; comicIndex < 5; comicIndex++) {
              await sendRandomGarfieldComic(i.channel, i.user.id, 'completion');
            }
            
            // Wait 2 seconds to ensure comics are displayed before success message
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await i.editReply({ content: `✅ Added "${selectedMovie.title}" to download list. There's no tracking on this- if it isn't in "the folder" in like 30 minutes then it probably failed and you should get a new one ` });
            
            // Disable the select menu after selection
            const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
              .addComponents(selectMenu.setDisabled(true));
            
            await message.edit({
              embeds: [embed],
              components: [disabledRow]
            });
          } catch (error) {
            Logger.error('Download failed:', error);
            
            try {
              if (!i.replied && !i.deferred) {
                await i.reply({ content: `❌ That download is fucked. Let me search again for "${title}"...`, ephemeral: false });
              } else {
                await i.editReply({ content: `❌ That download is fucked. Let me search again for "${title}"...` });
              }
              
              // Retry the search automatically
              setTimeout(async () => {
                try {
                  const retryResults = await hydra.searchMovies(title);
                  
                  if (retryResults.length === 0) {
                    if (i.channel && 'send' in i.channel) {
                      await i.channel.send(`Still no movie releases found for "${title}". The indexers are being difficult today.`);
                    }
                    return;
                  }

                  // Create new embed with fresh results
                  const retryEmbed = new EmbedBuilder()
                    .setTitle(`🔄 Fresh Search Results for "${title}" (Retry)`)
                    .setColor(0xFF6600)
                    .setTimestamp();

                  retryResults.slice(0, 10).forEach((result, index) => {
                    retryEmbed.addFields({
                      name: `🎬 ${index + 1}. ${result.title}`,
                      value: `**Size:** ${(result.size / 1024 / 1024 / 1024).toFixed(2)}GB`
                    });
                  });

                  // Create new select menu with retry results
                  const retrySelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('movie_select_retry')
                    .setPlaceholder('Choose a movie from fresh results')
                    .addOptions(
                      retryResults.slice(0, 10).map((result, index) => {
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

                  const retryRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(retrySelectMenu);

                  const retryMessage = (i.channel && 'send' in i.channel) ? 
                    await i.channel.send({
                      embeds: [retryEmbed],
                      components: [retryRow]
                    }) : null;

                  // Handle retry select menu interaction
                  if (retryMessage) {
                    const retryCollector = retryMessage.createMessageComponentCollector({
                      time: 60000
                    });

                    retryCollector.on('collect', async (retryI: StringSelectMenuInteraction) => {
                      if (retryI.customId === 'movie_select_retry') {
                        const selectedGuid = retryI.values[0];
                        const selectedMovie = retryResults.find(result => result.guid === selectedGuid);
                        
                        if (!selectedMovie) {
                          await retryI.reply({ content: '❌ Selected movie not found', ephemeral: true });
                          return;
                        }

                        try {
                          await retryI.deferReply();
                          
                          // Show attempting message first
                          await retryI.editReply({ content: `🔄 Attempting to add "${selectedMovie.title}" to download list. Here's some reading material while I get that cooking...` });
                          
                          const nzbUrl = await hydra.getNzbUrl(selectedGuid);
                          await sabnzbd.addNzb(nzbUrl, 'movies');
                          
                          // Send 5 Garfield comics as reading material
                          for (let comicIndex = 0; comicIndex < 5; comicIndex++) {
                            await sendRandomGarfieldComic(retryI.channel, retryI.user.id, 'completion');
                          }
                          
                          // Wait 2 seconds to ensure comics are displayed before success message
                          await new Promise(resolve => setTimeout(resolve, 2000));
                          
                          await retryI.editReply({ content: `✅ Added "${selectedMovie.title}" to download list. There's no tracking on this- if it isn't in "the folder" in like 30 minutes then it probably failed and you should get a new one ` });
                          
                          // Disable the retry select menu
                          const disabledRetryRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(retrySelectMenu.setDisabled(true));
                          
                          await retryMessage.edit({
                            embeds: [retryEmbed],
                            components: [disabledRetryRow]
                          });
                        } catch (retryError) {
                          Logger.error('Retry download failed:', retryError);
                          if (!retryI.replied && !retryI.deferred) {
                            await retryI.reply({ content: '❌ This one is also fucked. Try a different search term.', ephemeral: false });
                          } else {
                            await retryI.editReply({ content: '❌ This one is also fucked. Try a different search term.' });
                          }
                        }
                      }
                    });

                    retryCollector.on('end', async () => {
                      try {
                        const disabledRetryRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                          .addComponents(retrySelectMenu.setDisabled(true));
                        
                        await retryMessage.edit({
                          embeds: [retryEmbed],
                          components: [disabledRetryRow]
                        });
                      } catch (error) {
                        Logger.debug('Failed to disable retry select menu:', error);
                      }
                    });
                  }
                } catch (retryError) {
                  Logger.error('Failed to retry search:', retryError);
                  if (i.channel && 'send' in i.channel) {
                    await i.channel.send(`Failed to retry search for "${title}". The indexers are having a bad day.`);
                  }
                }
              }, 2000); // Wait 2 seconds before retry
              
            } catch (replyError) {
              Logger.error('Failed to send error message:', replyError);
              // Try to send as channel message if interaction fails
              try {
                if (i.channel && 'send' in i.channel) {
                  await i.channel.send(`❌ Download failed for "${selectedMovie.title}" and couldn't respond to interaction. Try again.`);
                }
              } catch (channelError) {
                Logger.error('Failed to send channel message:', channelError);
              }
            }
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
