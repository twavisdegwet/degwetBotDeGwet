import { Client, Collection, GatewayIntentBits, REST, Routes, Interaction } from 'discord.js';
import { env } from '../config/env';
import * as getAudiobookCommand from './commands/getaudiobook';
import * as getEbookCommand from './commands/getebook';
import * as gdriveUploadCommand from './commands/gdrive-upload';
import * as gdriveStatusCommand from './commands/gdrive-status';
import * as helpCommand from './commands/help';
import { getPersonality } from './badjokes';
import { handleGDriveUploadInteraction } from './commands/gdrive-upload';
import { handleAutoUploadInteraction, handleDuplicateUploadInteraction } from './utils';

interface CustomClient extends Client {
  commands: Collection<string, any>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as CustomClient;

client.commands = new Collection();
client.commands.set(getAudiobookCommand.data.name, getAudiobookCommand);
client.commands.set(getEbookCommand.data.name, getEbookCommand);
client.commands.set(gdriveUploadCommand.data.name, gdriveUploadCommand);
client.commands.set(gdriveStatusCommand.data.name, gdriveStatusCommand);
client.commands.set(helpCommand.data.name, helpCommand);

const commands = [
  getAudiobookCommand.data,
  getEbookCommand.data,
  gdriveUploadCommand.data,
  gdriveStatusCommand.data,
  helpCommand.data
];

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully reloaded application (/) commands globally.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', () => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const joke = getPersonality();
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
      } else {
        await interaction.reply({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
      }
    }
  } else if (interaction.isButton()) {
    try {
      // Use the unified upload button handler system
      if (interaction.customId.startsWith('auto_upload:')) {
        await handleAutoUploadInteraction(interaction);
      } else if (interaction.customId.startsWith('duplicate_')) {
        await handleDuplicateUploadInteraction(interaction);
      } else if (interaction.customId.startsWith('gdrive_upload:')) {
        await handleGDriveUploadInteraction(interaction);
      } else {
        // Fallback for any other button interactions
        console.log(`Unhandled button interaction: ${interaction.customId}`);
        await interaction.reply({ content: `I don't know what that button does. ${getPersonality()}`, flags: 64 });
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      // Only try to reply if the interaction hasn't been replied to or deferred
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: `There was an error while handling this button press! ${getPersonality()}`, flags: 64 });
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      } else {
        // If already replied/deferred, try to follow up or edit
        try {
          const joke = getPersonality();
          if (interaction.deferred) {
            await interaction.editReply({ content: `There was an error while handling this button press! ${joke}` });
          } else {
            await interaction.followUp({ content: `There was an error while handling this button press! ${joke}`, flags: 64 });
          }
        } catch (followUpError) {
          console.error('Failed to send error follow-up:', followUpError);
        }
      }
    }
  }
});

if (env.DISCORD_TOKEN && env.DISCORD_TOKEN !== 'your_discord_bot_token_here') {
  client.login(env.DISCORD_TOKEN);
  console.log('Discord bot starting...');
} else {
  console.log('Discord bot token not configured. Skipping Discord bot startup.');
}

export { client };
