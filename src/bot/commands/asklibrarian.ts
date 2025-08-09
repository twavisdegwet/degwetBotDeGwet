import { ChatInputCommandInteraction, SlashCommandBuilder, Message } from 'discord.js';
import { getLibrarianResponse } from '../personalities/librarian';
import { getPersonality } from '../badjokes';

export const data = new SlashCommandBuilder()
    .setName('asklibrarian')
    .setDescription('Consult the librarian for book recommendations and availability')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Your question or request for the librarian')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('format')
            .setDescription('Preferred format (default: any)')
            .addChoices(
                { name: 'Any format', value: 'any' },
                { name: 'E-book only', value: 'ebook' },
                { name: 'Audiobook only', value: 'audiobook' }
            ))
    .addIntegerOption(option =>
        option.setName('limit')
            .setDescription('Maximum number of recommendations (default: 5)')
            .setMinValue(1)
            .setMaxValue(10));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const query = interaction.options.getString('query', true);
        const format = interaction.options.getString('format') as 'ebook' | 'audiobook' | 'any' || 'any';
        const limit = interaction.options.getInteger('limit') || 5;

        console.log(`Librarian request: "${query}" (format: ${format}, limit: ${limit})`);

        const response = await getLibrarianResponse(query, format, limit);
        
        // Check if this is a clarification request
        if (response.includes('📚') && (response.includes('Could you please specify') || 
            response.includes('need some clarification') || response.includes('more context'))) {
            
            await interaction.editReply({ content: response + '\n\n*Please reply with your clarification, and I\'ll help you find what you\'re looking for!*' });
            
            // Wait for a follow-up message from the user
            try {
                const filter = (msg: Message) => msg.author.id === interaction.user.id;
                const channel = interaction.channel;
                
                if (!channel || !('awaitMessages' in channel)) {
                    throw new Error('Channel does not support message collection');
                }
                
                const collected = await channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 300000, // 5 minutes
                    errors: ['time'] 
                });
                
                if (collected && collected.size > 0) {
                    const followUpMessage = collected.first();
                    if (followUpMessage) {
                        console.log(`Librarian follow-up from ${interaction.user.username}: ${followUpMessage.content}`);
                        
                        // Combine the original query with the follow-up for better context
                        const combinedQuery = `Original request: "${query}". Follow-up: "${followUpMessage.content}"`;
                        const followUpResponse = await getLibrarianResponse(combinedQuery, format, limit);
                        await interaction.followUp({ content: followUpResponse });
                    }
                }
            } catch (timeoutError) {
                console.log('Librarian clarification timed out');
                await interaction.followUp({ 
                    content: '📚 I\'ll be here when you\'re ready to continue your book search! Just use `/asklibrarian` again.' 
                });
            }
        } else {
            await interaction.editReply({ content: response });
        }

    } catch (err) {
        console.error('Librarian consultation failure:', err);
        const errorMessage = `📚 The librarian is currently reorganizing the card catalog and can't help right now. ${getPersonality()} Try again in a moment!`;
        await interaction.editReply({ content: errorMessage });
    }
}
