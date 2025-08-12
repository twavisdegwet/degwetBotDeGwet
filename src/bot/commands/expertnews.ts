import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, getPersonalityFormatting } from '../personalities';
import { fetchBlueskyPosts, formatBlueskyPostsForPrompt } from '../../api/clients/bskyclient';


export const data = new SlashCommandBuilder()
    .setName('expertnews')
    .setDescription('Ask one of our expert consultants to summarize the latest social media posts')
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
            .setDescription('Number of recent messages to include as context (default: 5)')
            .setMinValue(0)
            .setMaxValue(25));


function splitMessageAtSentence(text: string, maxLength: number = 1800): string[] {
    if (text.length <= maxLength) {
        return [text];
    }
    
    const messages: string[] = [];
    let currentMessage = '';
    
    // Split by sentences (looking for . ! ? followed by space or end of string)
    const sentences = text.split(/([.!?]\s+|[.!?]$)/);
    
    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i + 1] || '';
        const fullSentence = sentence + punctuation;
        
        if (currentMessage.length + fullSentence.length <= maxLength) {
            currentMessage += fullSentence;
        } else {
            if (currentMessage.trim()) {
                messages.push(currentMessage.trim());
            }
            currentMessage = fullSentence;
        }
    }
    
    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }
    
    return messages;
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const expertChoice = interaction.options.getString('expert') || 'random';
        const contextLimit = interaction.options.getInteger('context') || 5;

        // Get the specified number of messages from the channel for context
        let messages: Collection<string, Message<true>> | undefined;
        if (interaction.channel?.type === ChannelType.GuildText && contextLimit > 0) {
            messages = await interaction.channel.messages.fetch({ limit: contextLimit });
        }

        // Prepare message context
        let messageContext = `[COMMAND ISSUED BY: ${interaction.user.username}]\n\n`;
        if (messages && contextLimit > 0) {
            const messageArray = Array.from(messages.values());
            messageContext += messageArray.map(msg => `${msg.author.username}: ${msg.content}`).reverse().join('\n');
        }

        // Fetch Bluesky posts
        console.log('Fetching latest Bluesky posts...');
        const posts = await fetchBlueskyPosts();
        
        if (posts.length === 0) {
            await interaction.editReply({ 
                content: "Sorry, I couldn't fetch any posts right now. Bluesky might be having issues." 
            });
            return;
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

        console.log(`Getting expert social media summary from ${selectedExpert}`);

        // Format posts for the prompt
        const postsContent = formatBlueskyPostsForPrompt(posts);
        
        // Define the expert task for social media summarization
        const expertTask = `You are hosting your own social media news show! You must present the latest posts from major news sources and commentators as if you're a social media correspondent delivering a live broadcast. You should:

1. Open with a greeting appropriate to your personality
2. Select and focus on the 3 most interesting/important posts from the feed (choose ones most relevant to the chat context, or your personal favorites if none apply)
3. Present each post with context and your unique perspective
4. Connect posts together when possible, showing relationships between topics
5. Add context, background, or implications that help viewers understand why these posts matter
6. If you need to fabricate reasonable context or background details to make the posts more engaging and understandable, do so confidently
7. Close with your signature sign-off

CRITICAL: Your entire social media broadcast must be under 4000 characters total. Write in a flowing, natural speaking style as if you're on TV. Address your audience directly. Make it engaging, informative, and distinctly in your character's voice, but keep it concise.

LATEST SOCIAL MEDIA POSTS:
${postsContent}

Now deliver your concise social media news broadcast focusing on your top 3 post picks!`;
        
        // Get prompt and make Ollama request
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);
        
        // Format the response directly without Q&A format (since this is a social media broadcast)
        const { emoji, name } = getPersonalityFormatting(selectedExpert);
        const cleanedResponse = response.response.replace(/\n\n+/g, '\n');
        const formattedResponse = `**${emoji} ${name}'s Social Media Broadcast:**\n${cleanedResponse}`;
        
        // Split the message if it's too long
        const messageParts = splitMessageAtSentence(formattedResponse);
        
        // Send the first part as the reply
        await interaction.editReply({ content: messageParts[0] });
        
        // Send additional parts as follow-ups if needed
        for (let i = 1; i < messageParts.length; i++) {
            await interaction.followUp({ content: messageParts[i] });
        }

    } catch (err) {
        const errorMessages: ErrorMessages = {
            timeout: 'Social media briefing timed out - our expert is still reading the posts!',
            network: 'Can\'t reach our social media sources or expert panel - network issues!',
            server: 'Social media analysis system error!',
            general: 'Our social media expert is currently unavailable - try again soon!'
        };

        const errorMessage = getOllamaErrorMessage(err, errorMessages);
        console.error('Expert social media consultation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}