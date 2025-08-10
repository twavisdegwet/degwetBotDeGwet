import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getPersonality } from '../badjokes';

export const data = new SlashCommandBuilder()
    .setName('makefunnyjoke')
    .setDescription('Gets a quick joke from our pre-written comedy collection')
    .addStringOption(option =>
        option.setName('topic')
            .setDescription('Topic for the joke (hidden feature: use "rats" for movie search)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const topic = interaction.options.getString('topic');
    
    // Hidden feature: if topic is "rats", redirect to movie search
    if (topic === 'rats') {
        // We need to import and execute the getmovie command dynamically to avoid circular dependencies
        try {
            const { command: getMovieCommand } = await import('./getmovie');
            
            // Create a mock interaction with movie search parameters
            const mockInteraction = {
                ...interaction,
                options: {
                    getString: (name: string) => {
                        if (name === 'title') return 'rats';
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
        } catch (error) {
            console.error('Error executing hidden movie search:', error);
            await interaction.reply({ content: '❌ Failed to search for movies. Please try again later.' });
            return;
        }
    }
    
    const joke = getPersonality();
    await interaction.reply({ content: joke });
}
