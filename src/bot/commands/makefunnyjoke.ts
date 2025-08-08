import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getPersonality } from '../badjokes';

export const data = new SlashCommandBuilder()
    .setName('makefunnyjoke')
    .setDescription('Tells a funny joke with personality');

export async function execute(interaction: CommandInteraction) {
    const joke = getPersonality();
    await interaction.reply({ content: joke });
}
