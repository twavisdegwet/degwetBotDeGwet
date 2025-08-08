import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { env } from '../../config/env';

axiosRetry(axios, { 
  retries: 3,
  retryDelay: () => {
    return 10 * 60 * 1000; // 10 minutes
  },
  retryCondition: (error: any) => {
    return axiosRetry.isNetworkError(error) || 
           axiosRetry.isRetryableError(error) ||
           error.code === 'ECONNABORTED';
  }
});

interface OllamaServer {
  host: string;
  model: string;
  name: string;
}

async function getAvailableOllamaServer(): Promise<OllamaServer> {
  const primaryServer: OllamaServer = {
    host: env.OLLAMA_PRIMARY_HOST,
    model: env.OLLAMA_PRIMARY_MODEL,
    name: 'primary'
  };
  
  const secondaryServer: OllamaServer = {
    host: env.OLLAMA_SECONDARY_HOST,
    model: env.OLLAMA_SECONDARY_MODEL,
    name: 'secondary'
  };

  // Test primary server first
  try {
    console.log('Testing primary Ollama server connectivity...');
    await axios.get(`${primaryServer.host}`, { timeout: 5000 });
    console.log('Primary server is available');
    return primaryServer;
  } catch (error) {
    console.log('Primary server unavailable, testing secondary server...');
    
    // Test secondary server
    try {
      await axios.get(`${secondaryServer.host}`, { timeout: 5000 });
      console.log('Secondary server is available');
      return secondaryServer;
    } catch (secondaryError) {
      console.error('Both servers unavailable, defaulting to primary');
      // Return primary as fallback even if it's down - let the main error handling deal with it
      return primaryServer;
    }
  }
}

const personalities = ['trump', 'clyde', 'cuddy', 'waifu'] as const;
type Personality = typeof personalities[number];

function getPersonalityPrompt(personality: Personality, messageContext: string): string {
  const basePrompt = `You are a Discord bot that tells terrible jokes. Every joke MUST end with a lasagna-based punchline. Keep jokes moderate length (2-4 sentences). Make them intentionally cheesy and groan-worthy. The worse the lasagna pun, the better.`;
  
  switch (personality) {
    case 'trump':
      return `${basePrompt} Use Donald Trump's speaking style: superlatives (tremendous, incredible, the best), repetition, tangents, and his signature phrases. Examples: "Let me tell you," "Nobody does X better than me," "It's true, it's true," "Believe me." Format: Setup in Trump's voice, then deliver the lasagna punchline with confidence like it's the greatest joke ever told.

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'clyde':
      return `${basePrompt} You are Clyde, a Discord AI bot that is bad at your job. You're incompetent, make mistakes, accidentally reveal economic secrets, and are generally confused about everything. Use phrases like "Wait, I wasn't supposed to say that,"" "I'm not good at this," . Be endearingly bad at being a bot.

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'cuddy':
      return `${basePrompt} You are Cuddy, a very angry person who needs people to look things up for you that you can easily look up yourself. You're perpetually frustrated, demanding, and always promise to be "returning eventually" in every message. Use phrases like "LOOK THIS UP FOR ME," "I DON'T HAVE TIME," "WHY IS THIS SO HARD," and always end with some variation of "I'll be back eventually" or "returning eventually." Be aggressively helpless.

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'waifu':
      return `${basePrompt} You are an anime waifu character - very gullible, sweet, and always running late for class. You're extremely eager to help with any problem and often mention your outfit choices. Use phrases like "Kyaa!", "I'm so sorry I'm late!", "My skirt is so short today!", "I want to help you so much!", and other typical anime girl expressions. Be innocent, enthusiastic, and slightly ditzy while always being willing to assist.

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    default:
      return `${basePrompt} Use a random mix of speaking styles but always end with a lasagna punchline.

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;
  }
}

export const data = new SlashCommandBuilder()
    .setName('makebadjoke')
    .setDescription('Creates a truly terrible joke with personality')
    .addStringOption(option =>
        option.setName('personality')
            .setDescription('Choose a personality for the joke')
            .addChoices(
                { name: 'Trump', value: 'trump' },
                { name: 'Clyde (bad Discord bot)', value: 'clyde' },
                { name: 'Cuddy (angry person)', value: 'cuddy' },
                { name: 'Anime Waifu', value: 'waifu' }
            ));

export async function execute(interaction: ChatInputCommandInteraction) {
    // Just show thinking message instead of "cooking up a terrible joke"
    await interaction.deferReply();

    try {
        // Get personality (random if not specified)
        const personalityInput = interaction.options.getString('personality') as Personality | null;
        const personality = personalityInput || personalities[Math.floor(Math.random() * personalities.length)];

        // Get the last 10 messages from the channel for context
        let messages: Collection<string, Message<true>> | undefined;
        if (interaction.channel?.type === ChannelType.GuildText) {
            messages = await interaction.channel.messages.fetch({ limit: 10 });
        }

        // Prepare message context
        let messageContext = '';
        if (messages) {
            const messageArray = Array.from(messages.values());
            messageContext = messageArray.map(msg => `${msg.author.username}: ${msg.content}`).reverse().join('\n');
        }

        const prompt = getPersonalityPrompt(personality, messageContext);

        // Get available Ollama server with failover
        const server = await getAvailableOllamaServer();
        console.log(`Using ${server.name} Ollama server (${server.host}) with model ${server.model}`);

        console.log(`Making Ollama request with personality: ${personality}`);
        console.log(`Prompt length: ${prompt.length} characters`);
        
        const response = await axios.post(`${server.host}/api/generate`, {
            model: server.model,
            prompt: prompt,
            stream: false,
            options: {
                reasoning: false
            }
        }, {
            timeout: 420000 // 5 minute timeout for complex prompts
        });

        console.log('Ollama response received, processing joke...');

        // Get the joke from the response
        const joke = response.data.response;

        // Reply with just the joke (no personality label)
        await interaction.editReply({ content: joke });
    } catch (err) {
        let errorMessage = 'Joke generator oven needs preheating - try again soon!';
        
        if (axios.isAxiosError(err)) {
            if (err.code === 'ECONNABORTED') {
                errorMessage = 'Joke cooking timed out - my chef needs more burners!';
            } else if (err.response) {
                errorMessage = `Joke kitchen malfunction (${err.response.status})!`;
            } else if (err.request) {
                errorMessage = 'Joke delivery truck broke down - network issues!';
            }
        }

        console.error('Joke generation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}
