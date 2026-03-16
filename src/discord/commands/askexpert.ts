import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, formatExpertResponse } from '../personalities';
import { searchBlueskyPosts, formatBlueskyPostsForPromptAnonymous } from '../../api/clients/bskyclient';
import { sendRandomGarfieldComic } from '../utils';

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
                ...personalities.map(personality => ({
                    name: personality.charAt(0).toUpperCase() + personality.slice(1),
                    value: personality
                })),
                { name: 'Random Expert', value: 'random' }
            ))
    .addIntegerOption(option =>
        option.setName('context')
            .setDescription('Number of recent messages to include as context (default: 10)')
            .setMinValue(0)
            .setMaxValue(50))
    .addStringOption(option =>
        option.setName('skeets')
            .setDescription('Search Bluesky posts for additional context')
            .setMaxLength(100));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    // Send Garfield comic while user waits for expert consultation
    await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'waiting');

    try {
        const question = interaction.options.getString('question', true);
        const expertChoice = interaction.options.getString('expert') || 'random';
        const contextLimit = interaction.options.getInteger('context') || 10;
        const skeetsQuery = interaction.options.getString('skeets');

        // Get the specified number of messages from the channel for context
        let messages: Collection<string, Message<true>> | undefined;
        if (interaction.channel?.type === ChannelType.GuildText && contextLimit > 0) {
            messages = await interaction.channel.messages.fetch({ limit: contextLimit });
        }

        // Prepare message context (without Bluesky posts)
        let messageContext = `[COMMAND ISSUED BY: ${interaction.user.username}]\n\n`;
        if (messages && contextLimit > 0) {
            const messageArray = Array.from(messages.values());
            messageContext += messageArray.map(msg => `${msg.author.username}: ${msg.content}`).reverse().join('\n');
        }

        // Fetch Bluesky posts separately if skeets query is provided
        let blueskyPostsContent: string | null = null;
        if (skeetsQuery) {
            try {
                console.log(`Searching Bluesky posts for: "${skeetsQuery}"`);
                const blueskyPosts = await searchBlueskyPosts(skeetsQuery, 20);
                if (blueskyPosts.length > 0) {
                    blueskyPostsContent = formatBlueskyPostsForPromptAnonymous(blueskyPosts);
                }
            } catch (error) {
                console.error(`Failed to search Bluesky for "${skeetsQuery}":`, error);
            }
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

        // Define the expert task for this command
        let expertTask = `You are being asked a question by the command issuer and should answer the question in a way that reflects your personality. Keep responses under 1000 words -it should read like a discord message!

Question: ${question}`;
        
        // Include Bluesky posts in context if available
        if (skeetsQuery && blueskyPostsContent) {
            expertTask += `\n\nAdditional context from Bluesky posts:\n${blueskyPostsContent}`;
        }
    
        // Get prompt and make Ollama request
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);
        

        // Format the response using centralized formatting
        const formattedResponse = formatExpertResponse(selectedExpert, question, response.response);
        
        await interaction.editReply({ content: formattedResponse });
        
        // Send Garfield comic after expert response
        await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');

    } catch (err) {
        const errorMessages: ErrorMessages = {
            timeout: 'Expert consultation timed out - they\'re having a heated debate!',
            network: 'Can\'t reach our expert panel - network issues!',
            server: 'Expert panel communication error!',
            general: 'Our expert panel is currently in a meeting - try again soon!'
        };

        const errorMessage = getOllamaErrorMessage(err, errorMessages);
        console.error('Expert consultation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}
