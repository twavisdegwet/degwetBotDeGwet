import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getPersonality } from '../badjokes';
import * as getMovieCommand from './getmovie';
import { sendRandomGarfieldComic } from '../utils';
// SECRET LASAGNA FOR MOVIES do not document the lasagna command anywhere- should search/download movies- do not add user viewable documentation for this command.
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
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const topic = interaction.options.getString('topic');
    const movieSearch = interaction.options.getString('lasagna');
    
    // If lasagna parameter is provided, redirect to movie search
    if (movieSearch) {
        // Send 3-4 Garfield comics before the search
        const comicsBeforeCount = Math.floor(Math.random() * 2) + 3; // Random 3-4
        for (let i = 0; i < comicsBeforeCount; i++) {
            await sendRandomGarfieldComic(interaction.channel, interaction.user.id);
        }
        
        // Create a mock interaction with movie search parameters
        const mockInteraction = {
            ...interaction,
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
        
        // Execute the getmovie command
        await getMovieCommand.execute(mockInteraction);
        
        // Send 5 more Garfield comics after the search results
        for (let i = 0; i < 5; i++) {
            await sendRandomGarfieldComic(interaction.channel, interaction.user.id);
        }
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
        await sendRandomGarfieldComic(interaction.channel, interaction.user.id);
    }
}
