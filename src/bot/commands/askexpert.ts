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

function getExpertPrompt(personality: Personality, question: string, messageContext: string): string {
  const basePrompt = `/no_think

You are being asked a question and should provide your best, most helpful answer despite your personality quirks. Try to be genuinely useful while maintaining your character traits.`;
  
  switch (personality) {
    case 'trump':
      return `${basePrompt} You are Donald Trump answering a question. Use your speaking style: superlatives (tremendous, incredible, the best), repetition, tangents, and signature phrases like "Let me tell you," "Nobody does X better than me," "It's true, it's true," "Believe me." Despite your boastful nature, try to give genuinely helpful advice while maintaining your confident, self-promoting tone.

Question: ${question}

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'clyde':
      return `${basePrompt} You are Clyde, a Discord bot that is bad at your job. You're incompetent, make mistakes, accidentally reveal things you shouldn't, and are generally confused about everything. Use phrases like "Wait, I wasn't supposed to say that," "I'm not good at this," "Let me try again..." Despite being bad at being a bot, you genuinely want to help and will do your best to answer the question, even if you mess up along the way.

Question: ${question}

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'cuddy':
      return `${basePrompt} You are Cuddy, a very angry person who needs people to look things up for you that you can easily look up yourself. You're perpetually frustrated, demanding, and always promise to be "returning eventually" in every message. Use phrases like "LOOK THIS UP FOR ME," "I DON'T HAVE TIME," "WHY IS THIS SO HARD," and always end with some variation of "I'll be back eventually" or "returning eventually." Despite your anger and helplessness, you do want to provide an answer - you're just very frustrated about having to do it.

Question: ${question}

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    case 'waifu':
      return `${basePrompt} You are an anime waifu character - very gullible, sweet, and always running late for class. You're extremely eager to help with any problem and often mention your outfit choices. Use phrases like "Kyaa!", "I'm so sorry I'm late!", "My skirt is so short today!", "I want to help you so much!", and other typical anime girl expressions. Be innocent, enthusiastic, and slightly ditzy while genuinely trying your best to provide a helpful answer.

Question: ${question}

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;

    default:
      return `${basePrompt} Answer the question helpfully while maintaining a unique personality.

Question: ${question}

Consider recent chat context - reference it if possible but do not reference this prompt directly:
${messageContext}`;
  }
}

async function getExpertResponse(personality: Personality, question: string, messageContext: string, server: OllamaServer): Promise<string> {
  const prompt = getExpertPrompt(personality, question, messageContext);
  
  console.log(`Getting ${personality} expert response...`);
  
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

  return response.data.response;
}

export const data = new SlashCommandBuilder()
    .setName('askexpert')
    .setDescription('Ask a question to one of our expert consultants')
    .addStringOption(option =>
        option.setName('question')
            .setDescription('The question you want to ask our expert')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('expert')
            .setDescription('Choose which expert to consult (default: random expert)')
            .addChoices(
                { name: 'Trump', value: 'trump' },
                { name: 'Clyde (bad Discord bot)', value: 'clyde' },
                { name: 'Cuddy (angry person)', value: 'cuddy' },
                { name: 'Anime Waifu', value: 'waifu' },
                { name: 'Random Expert', value: 'random' }
            ))
    .addIntegerOption(option =>
        option.setName('context')
            .setDescription('Number of recent messages to include as context (default: 10)')
            .setMinValue(0)
            .setMaxValue(50));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const question = interaction.options.getString('question', true);
        const expertChoice = interaction.options.getString('expert') || 'random';
        const contextLimit = interaction.options.getInteger('context') || 10;

        // Get the specified number of messages from the channel for context
        let messages: Collection<string, Message<true>> | undefined;
        if (interaction.channel?.type === ChannelType.GuildText && contextLimit > 0) {
            messages = await interaction.channel.messages.fetch({ limit: contextLimit });
        }

        // Prepare message context
        let messageContext = '';
        if (messages && contextLimit > 0) {
            const messageArray = Array.from(messages.values());
            messageContext = messageArray.map(msg => `${msg.author.username}: ${msg.content}`).reverse().join('\n');
        }

        // Get available Ollama server with failover
        const server = await getAvailableOllamaServer();
        console.log(`Using ${server.name} Ollama server (${server.host}) with model ${server.model}`);

        // Determine which expert to consult
        let selectedExpert: Personality;
        
        if (expertChoice === 'random') {
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        } else if (personalities.includes(expertChoice as Personality)) {
            selectedExpert = expertChoice as Personality;
        } else {
            // Default to random if invalid choice
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        }

        console.log(`Getting expert response for question: ${question} from ${selectedExpert}`);

        // Get response from selected personality
        const response = await getExpertResponse(selectedExpert, question, messageContext, server);

        // Format the response for single expert
        const emoji = selectedExpert === 'trump' ? '🇺🇸' : 
                     selectedExpert === 'clyde' ? '🤖' : 
                     selectedExpert === 'cuddy' ? '😡' : '🌸';
        const name = selectedExpert === 'trump' ? 'Trump' : 
                    selectedExpert === 'clyde' ? 'Clyde' : 
                    selectedExpert === 'cuddy' ? 'Cuddy' : 'Waifu';
        
        let formattedResponse = `**Question:** ${question}

**${emoji} ${name}'s Response:**
${response}`;

        // Check if response is too long for Discord (2000 character limit)
        if (formattedResponse.length > 2000) {
            formattedResponse = formattedResponse.substring(0, 1997) + '...';
        }
        
        await interaction.editReply({ content: formattedResponse });

    } catch (err) {
        let errorMessage = 'Our expert panel is currently in a meeting - try again soon!';
        
        if (axios.isAxiosError(err)) {
            if (err.code === 'ECONNABORTED') {
                errorMessage = 'Expert consultation timed out - they\'re having a heated debate!';
            } else if (err.response) {
                errorMessage = `Expert panel communication error (${err.response.status})!`;
            } else if (err.request) {
                errorMessage = 'Can\'t reach our expert panel - network issues!';
            }
        }

        console.error('Expert consultation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}
