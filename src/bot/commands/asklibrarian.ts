import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
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
        
        await interaction.editReply({ content: response });

    } catch (err) {
        console.error('Librarian consultation failure:', err);
        const errorMessage = `📚 The librarian is currently reorganizing the card catalog and can't help right now. ${getPersonality()} Try again in a moment!`;
        await interaction.editReply({ content: errorMessage });
    }
}
