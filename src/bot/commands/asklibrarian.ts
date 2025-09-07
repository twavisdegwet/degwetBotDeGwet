import { ChatInputCommandInteraction, SlashCommandBuilder, Message } from 'discord.js';
import { getLibrarianResponse } from '../personalities/librarian';
import { getPersonality } from '../badjokes';
import { sendRandomGarfieldComic } from '../utils';

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

    // Send Garfield comic while user waits for librarian consultation
    await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'waiting');

    try {
        const query = interaction.options.getString('query', true);
        const format = interaction.options.getString('format') as 'ebook' | 'audiobook' | 'any' || 'any';
        const limit = interaction.options.getInteger('limit') || 5;

        console.log(`Librarian request: "${query}" (format: ${format}, limit: ${limit})`);

        const response = await getLibrarianResponse(query, format);
        
        // Check if this needs follow-up (broader criteria for engagement)
        const needsFollowUp = response.includes('📚') && (
            response.includes('Could you please specify') || 
            response.includes('need some clarification') || 
            response.includes('more context') ||
            response.includes('Would you like') ||
            response.includes('Any particular') ||
            response.includes('Should I look for') ||
            response.includes('similar books') ||
            response.includes('multiple results') ||
            response.includes('which one')
        );
        
        if (needsFollowUp) {
            await interaction.editReply({ content: response + '\n\n*💬 Feel free to reply with follow-up questions - I\'m here to help you find the perfect book!*' });
            
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
                    time: 600000, // 10 minutes (extended)
                    errors: ['time'] 
                });
                
                if (collected && collected.size > 0) {
                    const followUpMessage = collected.first();
                    if (followUpMessage) {
                        console.log(`Librarian follow-up from ${interaction.user.username}: ${followUpMessage.content}`);
                        
                        // Add reaction to show we're processing
                        await followUpMessage.react('📚');
                        
                        // Combine the original query with the follow-up for better context
                        const combinedQuery = `Previous conversation context: Original request was "${query}" (format: ${format}). My previous response: "${response}". User's follow-up: "${followUpMessage.content}"`;
                        const followUpResponse = await getLibrarianResponse(combinedQuery, format);
                        await interaction.followUp({ content: followUpResponse });
                    }
                }
            } catch (timeoutError) {
                console.log('Librarian follow-up timed out');
                await interaction.followUp({ 
                    content: '📚 I\'m always here to help with your book searches! Just use `/asklibrarian` again anytime.' 
                });
            }
        } else {
            // Even for simple responses, offer follow-up capability
            const finalResponse = response + '\n\n*📖 Need more book recommendations? Just reply and I\'ll keep helping!*';
            await interaction.editReply({ content: finalResponse });
            
            // Brief follow-up window for simple responses too
            try {
                const filter = (msg: Message) => msg.author.id === interaction.user.id;
                const channel = interaction.channel;
                
                if (channel && 'awaitMessages' in channel) {
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
                            await followUpMessage.react('📚');
                            
                            const combinedQuery = `Previous conversation: I helped with "${query}" and gave this response: "${response}". User's new question: "${followUpMessage.content}"`;
                            const followUpResponse = await getLibrarianResponse(combinedQuery, format);
                            await interaction.followUp({ content: followUpResponse });
                        }
                    }
                }
            } catch (timeoutError) {
                // Silent timeout for simple responses
                console.log('Librarian brief follow-up timed out');
            }
        }

    } catch (err) {
        console.error('Librarian consultation failure:', err);
        const errorMessage = `📚 The librarian is currently reorganizing the card catalog and can't help right now. ${getPersonality()} Try again in a moment!`;
        await interaction.editReply({ content: errorMessage });
    }
}
