import { Client } from 'discord.js';
import { getRandomBusyJoke } from './badjokes';

const BLOCKED_USER_ID = '214899404627378176';

export async function isUserPlayingGame(client: Client): Promise<boolean> {
  try {
    // Check if client is properly initialized
    if (!client || !client.guilds) {
      console.log('Client not properly initialized');
      return false;
    }

    // Get presence from all guilds the user is in
    for (const guild of client.guilds.cache.values()) {
      try {
        // Fetch the member to ensure we have up-to-date presence info
        const member = await guild.members.fetch(BLOCKED_USER_ID).catch(() => null);
        if (member && member.presence) {
          const activities = member.presence.activities;
          
          // Check if any activity is a game (type 0)
          const hasGameActivity = activities.some(activity => activity.type === 0);
          
          if (hasGameActivity) {
            console.log(`User ${BLOCKED_USER_ID} is currently playing a game`);
            return true;
          }
        }
      } catch (guildError) {
        // Continue to next guild if there's an error with this one
        console.debug(`Error checking guild ${guild.id}:`, guildError);
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking user presence:', error);
    // On error, default to allowing access (fail open)
    return false;
  }
}

export function createPresenceBlockedMessage(): string {
  return getRandomBusyJoke();
}