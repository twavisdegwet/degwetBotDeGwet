"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const env_1 = require("../config/env");
const getAudiobookCommand = __importStar(require("./commands/getaudiobook"));
const getEbookCommand = __importStar(require("./commands/getebook"));
const gdriveUploadCommand = __importStar(require("./commands/gdrive-upload"));
const gdriveStatusCommand = __importStar(require("./commands/gdrive-status"));
const helpCommand = __importStar(require("./commands/help"));
const makeFunnyJokeCommand = __importStar(require("./commands/makefunnyjoke"));
const makeBadJokeCommand = __importStar(require("./commands/makebadjoke"));
const badjokes_1 = require("./badjokes");
const gdrive_upload_1 = require("./commands/gdrive-upload");
const utils_1 = require("./utils");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
exports.client = client;
client.commands = new discord_js_1.Collection();
client.commands.set(getAudiobookCommand.data.name, getAudiobookCommand);
client.commands.set(getEbookCommand.data.name, getEbookCommand);
client.commands.set(gdriveUploadCommand.data.name, gdriveUploadCommand);
client.commands.set(gdriveStatusCommand.data.name, gdriveStatusCommand);
client.commands.set(helpCommand.data.name, helpCommand);
client.commands.set(makeFunnyJokeCommand.data.name, makeFunnyJokeCommand);
client.commands.set(makeBadJokeCommand.data.name, makeBadJokeCommand);
const commands = [
    getAudiobookCommand.data,
    getEbookCommand.data,
    gdriveUploadCommand.data,
    gdriveStatusCommand.data,
    helpCommand.data,
    makeFunnyJokeCommand.data,
    makeBadJokeCommand.data
];
const rest = new discord_js_1.REST({ version: '10' }).setToken(env_1.env.DISCORD_TOKEN);
async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(discord_js_1.Routes.applicationCommands(env_1.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands globally.');
    }
    catch (error) {
        console.error('Error registering commands:', error);
    }
}
client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
    registerCommands();
});
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            await command.execute(interaction);
        }
        catch (error) {
            console.error(error);
            const joke = (0, badjokes_1.getPersonality)();
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
            }
            else {
                await interaction.reply({ content: `There was an error while executing this command! ${joke}`, flags: 64 });
            }
        }
    }
    else if (interaction.isButton()) {
        try {
            if (interaction.customId.startsWith('auto_upload:')) {
                await (0, utils_1.handleAutoUploadInteraction)(interaction);
            }
            else if (interaction.customId.startsWith('duplicate_')) {
                await (0, utils_1.handleDuplicateUploadInteraction)(interaction);
            }
            else if (interaction.customId.startsWith('gdrive_upload:')) {
                await (0, gdrive_upload_1.handleGDriveUploadInteraction)(interaction);
            }
            else {
                console.log(`Unhandled button interaction: ${interaction.customId}`);
                await interaction.reply({ content: `I don't know what that button does. ${(0, badjokes_1.getPersonality)()}`, flags: 64 });
            }
        }
        catch (error) {
            console.error('Error handling button interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: `There was an error while handling this button press! ${(0, badjokes_1.getPersonality)()}`, flags: 64 });
                }
                catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            }
            else {
                try {
                    const joke = (0, badjokes_1.getPersonality)();
                    if (interaction.deferred) {
                        await interaction.editReply({ content: `There was an error while handling this button press! ${joke}` });
                    }
                    else {
                        await interaction.followUp({ content: `There was an error while handling this button press! ${joke}`, flags: 64 });
                    }
                }
                catch (followUpError) {
                    console.error('Failed to send error follow-up:', followUpError);
                }
            }
        }
    }
});
if (env_1.env.DISCORD_TOKEN && env_1.env.DISCORD_TOKEN !== 'your_discord_bot_token_here') {
    client.login(env_1.env.DISCORD_TOKEN);
    console.log('Discord bot starting...');
}
else {
    console.log('Discord bot token not configured. Skipping Discord bot startup.');
}
//# sourceMappingURL=index.js.map