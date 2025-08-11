import { Client } from 'discord.js';
import { getRandomBusyJoke } from './badjokes';

const BLOCKED_USER_ID = '214899404627378176';

export async function isUserPlayingGame(client: Client): Promise<boolean> {
  try {
    const user = await client.users.fetch(BLOCKED_USER_ID);
    
    if (!user) {
      console.log(`User ${BLOCKED_USER_ID} not found`);
      return false;
    }

    // Get presence from all guilds the user is in
    for (const guild of client.guilds.cache.values()) {
      const member = guild.members.cache.get(BLOCKED_USER_ID);
      if (member && member.presence) {
        const activities = member.presence.activities;
        
        // Check if any activity is a game (type 0)
        const hasGameActivity = activities.some(activity => activity.type === 0);
        
        if (hasGameActivity) {
          console.log(`User ${BLOCKED_USER_ID} is currently playing a game`);
          return true;
        }
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