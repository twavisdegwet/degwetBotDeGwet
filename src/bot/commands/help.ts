import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows available commands and how to use the book download bot');

export async function execute(interaction: CommandInteraction) {
  await interaction.reply({
    embeds: [{
      title: '📚 Book Download Bot Help - Now with More Lasagna!',
      description: 'This bot helps you download books. It\'s almost as good as a nap. Almost.',
      fields: [
        {
          name: '🎧 Audiobook Search & Download',
          value: 'Search for audiobooks with VIP/freeleech handling\n• Multiple audio formats: MP3, FLAC, M4A, M4B\n• Automatic duplicate detection\n• Freeleech for VIP torrents\n• Author and format filtering',
          inline: false
        },
        {
          name: '📖 E-Book Search & Download',
          value: 'Search for e-books with VIP/freeleech handling\n• Multiple e-book formats: EPUB, MOBI, AZW3, PDF, TXT\n• Automatic duplicate detection\n• Freeleech for VIP torrents\n• Author and format filtering',
          inline: false
        },
        {
          name: '☁️ Google Drive Integration',
          value: 'Automatic and manual uploads to Google Drive\n• Automatic upload when downloads complete\n• Manual upload with `/gdrive-upload`\n• Content analysis and folder organization\n• Clickable folder links in success messages',
          inline: false
        },
        {
          name: '🔄 MP3 to M4B Conversion',
          value: 'Automatic conversion for audiobook files\n• Triggered automatically for all audiobooks\n• Manual conversion with `convert_mp3` flag\n• Creates M4B with proper metadata',
          inline: false
        }
      ],
      color: 0x00AE86,
      footer: {
        text: 'This bot was made with love, and a deep appreciation for lasagna. 📖'
      }
    }]
  });
}
