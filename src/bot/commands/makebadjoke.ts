import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities } from '../personalities';

export const data = new SlashCommandBuilder()
    .setName('makebadjoke')
    .setDescription('Creates a truly terrible joke with personality')
    .addStringOption(option =>
        option.setName('personality')
            .setDescription('Choose a personality for the joke')
            .addChoices(
                ...personalities.map(personality => ({
                    name: personality.charAt(0).toUpperCase() + personality.slice(1),
                    value: personality
                } as const)),
                { name: 'Random', value: 'random' }
            ));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        // Get personality (random if not specified)
        const personalityInput = interaction.options.getString('personality');
        const personality = (personalityInput === 'random' || !personalityInput)
            ? personalities[Math.floor(Math.random() * personalities.length)]
            : personalityInput as Personality;

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

        // Define the joke task for this command
        const jokeTask = `You are a Discord bot roleplaying as the requested personality that tells a joke. Keep responses under 200 words. Every joke MUST end have something to do with garfield. Make sure to showcase your personality and context from messages`;

        // Get available Ollama server with failover
        const server = await getAvailableOllamaServer();
        console.log(`Using ${server.name} Ollama server (${server.host}) with model ${server.model}`);

        console.log(`Making Ollama request with personality: ${personality}`);

        // Build prompt with personality applied to the joke task
        const prompt = buildPersonalityPrompt(personality, jokeTask, messageContext);

        // Make Ollama request with joke-specific options
        const jokeResponse = await makeOllamaRequest(prompt, server, {
            temperature: 0.9,
            repeat_penalty: 1.3,
            top_p: 0.9,
            top_k: 40
        });

        console.log('Ollama response received, processing joke...');

        // Reply with just the joke (no personality label)
        await interaction.editReply({ content: jokeResponse.response });
    } catch (err) {
        const errorMessages: ErrorMessages = {
            timeout: 'Joke cooking timed out - my chef needs more burners!',
            network: 'Joke delivery truck broke down - network issues!',
            server: 'Joke kitchen malfunction!',
            general: 'Joke generator oven needs preheating - try again soon!'
        };

        const errorMessage = getOllamaErrorMessage(err, errorMessages);
        console.error('Joke generation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}
