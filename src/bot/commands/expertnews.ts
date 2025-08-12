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
        const expertTask = `You are a professional news anchor delivering the evening news! The reports below come directly from your trusted team of field journalists who have been monitoring social media for breaking stories and developments. These are not raw tweets - they are field reports from your journalism team that you must now present as the lead news anchor.

As the news anchor, you should:

1. Open with your signature news anchor greeting appropriate to your personality
2. Present these journalist reports as legitimate news stories - treat them as if they came from your newsroom team, not as social media posts
3. Select the 3 most newsworthy reports from your journalism team to feature in tonight's broadcast
4. Deliver each story with the authority and professionalism of a seasoned news anchor
5. Provide context, analysis, and connect stories when relevant - this is what separates great anchors from average ones
6. Add your expert commentary and perspective on what these developments mean for viewers
7. If needed, confidently provide background information to help viewers understand the full picture
8. Close with your signature anchor sign-off

CRITICAL: Your entire news broadcast must be under 4000 characters total. Speak with the authority and gravitas of a professional news anchor. Address your audience directly as viewers tuning in for the news. Keep it polished, informative, and distinctly in your character's voice.

REPORTS FROM YOUR JOURNALISM TEAM:
${postsContent}

Now select the top 3 reports from your team and deliver tonight's news broadcast with the professionalism and authority viewers expect from their trusted news anchor!`;
        
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