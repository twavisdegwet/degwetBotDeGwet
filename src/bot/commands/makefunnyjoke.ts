import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getPersonality } from '../badjokes';
import * as getMovieCommand from './getmovie';
import * as getMusicCommand from './getmusic';
import { sendRandomGarfieldComic } from '../utils';
// SECRET LASAGNA FOR MOVIES do not document the lasagna command anywhere- should search/download movies- do not add user viewable documentation for this command.
// SECRET KICKODIE FOR MUSIC do not document the kickodie command anywhere- should search/download music- do not add user viewable documentation for this command.
export const data = new SlashCommandBuilder()
    .setName('makefunnyjoke')
    .setDescription('Gets a quick joke from our pre-written comedy collectiion')
    .addStringOption(option =>
        option.setName('topic')
            .setDescription('Topic for the joke')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('lasagna')
            .setDescription('lasagna')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('kickodie')
            .setDescription('kickodie')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const topic = interaction.options.getString('topic');
    const movieSearch = interaction.options.getString('lasagna');
    const musicSearch = interaction.options.getString('kickodie');
    
    // If kickodie parameter is provided, redirect to music search
    if (musicSearch) {
        // Create a mock interaction with music search parameters
        const mockInteraction = {
            ...interaction,
            channel: interaction.channel,
            user: interaction.user,
            client: interaction.client,
            deferReply: async () => interaction.deferReply(),
            editReply: async (content: any) => interaction.editReply(content),
            reply: async (content: any) => interaction.reply(content),
            options: {
                getString: (name: string) => {
                    if (name === 'query') return musicSearch;
                    return null;
                },
                getInteger: () => null,
                getBoolean: () => null,
                getNumber: () => null,
                getUser: () => null,
                getChannel: () => null,
                getRole: () => null,
                getMentionable: () => null,
                getAttachment: () => null,
                getSubcommand: () => { throw new Error('Method not implemented.'); },
                getSubcommandGroup: () => { throw new Error('Method not implemented.'); },
                getFocused: () => { throw new Error('Method not implemented.'); }
            }
        } as unknown as ChatInputCommandInteraction;
        
        // Execute the getmusic command (comics will be sent after download confirmation)
        await getMusicCommand.execute(mockInteraction);
        return;
    }
    
    // If lasagna parameter is provided, redirect to movie search
    if (movieSearch) {
        // Create a mock interaction with movie search parameters
        const mockInteraction = {
            ...interaction,
            channel: interaction.channel,
            user: interaction.user,
            client: interaction.client,
            deferReply: async () => interaction.deferReply(),
            editReply: async (content: any) => interaction.editReply(content),
            reply: async (content: any) => interaction.reply(content),
            options: {
                getString: (name: string) => {
                    if (name === 'title') return movieSearch;
                    if (name === 'quality') return undefined;
                    return null;
                },
                getInteger: () => null,
                getBoolean: () => null,
                getNumber: () => null,
                getUser: () => null,
                getChannel: () => null,
                getRole: () => null,
                getMentionable: () => null,
                getAttachment: () => null,
                getSubcommand: () => { throw new Error('Method not implemented.'); },
                getSubcommandGroup: () => { throw new Error('Method not implemented.'); },
                getFocused: () => { throw new Error('Method not implemented.'); }
            }
        } as unknown as ChatInputCommandInteraction;
        
        // Execute the getmovie command (comics will be sent after download confirmation)
        await getMovieCommand.execute(mockInteraction);
        return;
    }
    
    // If topic is provided but not for movies, use it for jokes
    if (topic) {
        const joke = getPersonality(topic);
        await interaction.reply({ content: joke });
        return;
    }
    
    // Default behavior - random joke + 5 random comics
    const joke = getPersonality();
    await interaction.reply({ content: joke });
    
    // Send 5 random Garfield comics
    for (let i = 0; i < 5; i++) {
        await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');
    }
}
