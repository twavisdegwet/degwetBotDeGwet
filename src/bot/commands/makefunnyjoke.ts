import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getPersonality } from '../badjokes';
import { command as getMovieCommand } from './getmovie';

export const data = new SlashCommandBuilder()
    .setName('makefunnyjoke')
    .setDescription('Gets a quick joke from our pre-written comedy collection or search for movies')
    .addStringOption(option =>
        option.setName('topic')
            .setDescription('Topic for the joke or movie search')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('movie-search')
            .setDescription('Search for movies with this title')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const topic = interaction.options.getString('topic');
    const movieSearch = interaction.options.getString('movie-search');
    
    // If movie-search parameter is provided, redirect to movie search
    if (movieSearch) {
        // Create a mock interaction with movie search parameters
        const mockInteraction = {
            ...interaction,
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
        return;
    }
    
    // If topic is provided but not for movies, use it for jokes
    if (topic) {
        const joke = getPersonality(topic);
        await interaction.reply({ content: joke });
        return;
    }
    
    // Default behavior - random joke
    const joke = getPersonality();
    await interaction.reply({ content: joke });
}
