import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getPersonality } from '../badjokes';

export const data = new SlashCommandBuilder()
    .setName('makefunnyjoke')
    .setDescription('Gets a quick joke from our pre-written comedy collection');

export async function execute(interaction: CommandInteraction) {
    const joke = getPersonality();
    await interaction.reply({ content: joke });
}
