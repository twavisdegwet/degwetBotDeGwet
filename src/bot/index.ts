import { Client, Collection, GatewayIntentBits, REST, Routes, Interaction } from 'discord.js';
import { env } from '../config/env';
import * as getAudiobookCommand from './commands/getaudiobook';
import * as getEbookCommand from './commands/getebook';
import * as gdriveUploadCommand from './commands/gdrive-upload';
import * as gdriveStatusCommand from './commands/gdrive-status';
import * as helpCommand from './commands/help';
import * as makeFunnyJokeCommand from './commands/makefunnyjoke';
import * as makeBadJokeCommand from './commands/makebadjoke';
import * as askExpertCommand from './commands/askexpert';
import * as askLibrarianCommand from './commands/asklibrarian';
// DO NOT RE-ADD: getmovie command is intentionally hidden - accessible via /makefunnyjoke lasagna
// import * as getMovieCommand from './commands/getmovie';
// DO NOT RE-ADD: getmusic command is intentionally hidden - accessible via /makefunnyjoke kickodie
// import * as getMusicCommand from './commands/getmusic';
import * as expertNewsCommand from './commands/expertnews';
import * as askBibleCommand from './commands/askbible';
import { getPersonality } from './badjokes';
import { handleGDriveUploadInteraction } from './commands/gdrive-upload';
import { handleAutoUploadInteraction, handleDuplicateUploadInteraction, handleKindleEmailInteraction } from './utils';

interface CustomClient extends Client {
  commands: Collection<string, any>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
}) as CustomClient;

client.commands = new Collection();
client.commands.set(getAudiobookCommand.data.name, getAudiobookCommand);
client.commands.set(getEbookCommand.data.name, getEbookCommand);
client.commands.set(gdriveUploadCommand.data.name, gdriveUploadCommand);
client.commands.set(gdriveStatusCommand.data.name, gdriveStatusCommand);
client.commands.set(helpCommand.data.name, helpCommand);
client.commands.set(makeFunnyJokeCommand.data.name, makeFunnyJokeCommand);
client.commands.set(makeBadJokeCommand.data.name, makeBadJokeCommand);
client.commands.set(askExpertCommand.data.name, askExpertCommand);
client.commands.set(askLibrarianCommand.data.name, askLibrarianCommand);
client.commands.set(expertNewsCommand.data.name, expertNewsCommand);
client.commands.set(askBibleCommand.data.name, askBibleCommand);

const commands = [
  getAudiobookCommand.data,
  getEbookCommand.data,
  gdriveUploadCommand.data,
  gdriveStatusCommand.data,
  helpCommand.data,
  makeFunnyJokeCommand.data,
  makeBadJokeCommand.data,
  askExpertCommand.data,
  askLibrarianCommand.data,
  expertNewsCommand.data,
  askBibleCommand.data
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
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
        } else {
          await interaction.reply({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
        }
      } catch (replyError) {
        console.error('Failed to send error reply for command:', replyError);
      }
    }
  } else if (interaction.isButton()) {
    try {
      // Use the unified upload button handler system
      if (interaction.customId.startsWith('auto_upload_') || interaction.customId.startsWith('auto_upload:')) {
        await handleAutoUploadInteraction(interaction);
      } else if (interaction.customId.startsWith('duplicate_') || interaction.customId.startsWith('duplicate:')) {
        await handleDuplicateUploadInteraction(interaction);
      } else if (interaction.customId.startsWith('gdrive_upload:')) {
        await handleGDriveUploadInteraction(interaction);
      } else if (interaction.customId.startsWith('kindle_email_')) {
        await handleKindleEmailInteraction(interaction);
      } else if (interaction.customId.startsWith('auto_cancel_') || interaction.customId.startsWith('duplicate_cancel_')) {
        // Handle cancel button
        await interaction.deferUpdate();
        await interaction.editReply({
          content: 'good we\'ve already gotten our lasagna- the rest can fend for themselves',
          components: []
        });
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
