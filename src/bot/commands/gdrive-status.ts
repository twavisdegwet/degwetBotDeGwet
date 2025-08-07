import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import axios from 'axios';
import { formatFileSize } from '../utils';

export const data = new SlashCommandBuilder()
    .setName('gdrive-status')
    .setDescription('☁️ Check Google Drive authentication status');

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ flags: 64 });
  
  try {
    const response = await axios.get('http://localhost:3000/api/uploads/status');
    
    if (response.data.success) {
      if (response.data.authenticated) {
        // Safely handle user data - it might not be available
        const user = response.data.user;
        let userDisplay = 'Unknown';
        if (user && user.displayName) {
          userDisplay = `${user.displayName} (${user.emailAddress || 'N/A'})`;
        } else if (user && user.emailAddress) {
          userDisplay = user.emailAddress;
        } else {
          userDisplay = 'Service account connected';
        }
        
        // Safely handle storage data
        const storage = response.data.storage;
        let storageDisplay = 'Storage information not available';
        if (storage && storage.usage && storage.limit) {
          storageDisplay = `Used: ${formatFileSize(parseInt(storage.usage))} / ${formatFileSize(parseInt(storage.limit))}`;
        }
        
        await interaction.editReply({
          embeds: [{
            title: '☁️ Google Drive Status - As Exciting as Lasagna!',
            description: '✅ Everything is connected! Even Garfield would be impressed. And he hates everything except lasagna.',
            fields: [
              {
                name: '👤 Service Account',
                value: userDisplay,
                inline: false
              },
              {
                name: '📁 Target Folder',
                value: response.data.folderId,
                inline: false
              },
              {
                name: '💾 Storage',
                value: storageDisplay,
                inline: false
              }
            ],
            color: 0x4285f4
          }]
        });
      } else {
        await interaction.editReply({
          embeds: [{
            title: '☁️ Google Drive Status - Oh No, a Monday!',
            description: '❌ Houston, we have a problem. And it\'s not that we\'re out of lasagna. The service account isn\'t connected.',
            fields: [
              {
                name: 'Service Account File',
                value: response.data.serviceAccountFileExists ? 'Configured' : 'Not configured',
                inline: false
              },
              {
                name: 'Issue',
                value: response.data.error || 'Service account authentication failed',
                inline: false
              }
            ],
            color: 0xff0000
          }]
        });
      }
    } else {
      await interaction.editReply('❌ Failed to check Google Drive status. This is worse than a Monday without coffee. Or lasagna.');
    }
  } catch (error: any) {
    console.error('Error checking gdrive status:', error);
    await interaction.editReply('❌ An error occurred. I bet that pesky dog Odie unplugged something. Or maybe it was Nermal.');
  }
}
