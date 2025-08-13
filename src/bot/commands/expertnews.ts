import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, getPersonalityFormatting } from '../personalities';
import { fetchBlueskyPosts, searchBlueskyPosts, formatBlueskyPostsForPromptAnonymous } from '../../api/clients/bskyclient';


export const data = new SlashCommandBuilder()
    .setName('expertnews')
    .setDescription('Ask one of our expert consultants to rattle off todays news')
    .addStringOption(option =>
        option.setName('expert')
            .setDescription('Choose which expert to anchor (default: random expert)')
            .addChoices(
                ...personalities.map(personality => ({
                    name: personality.charAt(0).toUpperCase() + personality.slice(1),
                    value: personality
                })),
                { name: 'Random Expert', value: 'random' }
            ))
    .addStringOption(option =>
        option.setName('topic')
            .setDescription('Generate up to date and 100% accurate news on a specific topic')
            .setMaxLength(100))
    .addIntegerOption(option =>
        option.setName('context')
            .setDescription('add surrounding messages for some reason')
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
        const topic = interaction.options.getString('topic');
        const contextLimit = interaction.options.getInteger('context') || 0;

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

        // Fetch Bluesky posts (search if topic provided, otherwise get latest)
        let posts;
        if (topic) {
            console.log(`Searching Bluesky posts for topic: "${topic}"`);
            posts = await searchBlueskyPosts(topic, 15);
        } else {
            console.log('Fetching latest Bluesky posts...');
            posts = await fetchBlueskyPosts();
        }
        
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

                // Use anonymous formatting for both to avoid direct citations
        const postsContent = formatBlueskyPostsForPromptAnonymous(posts);
        
        // Create different prompts based on whether we're doing topic search or general news
        let expertTask: string;
        
        if (topic) {
            expertTask = `You're hosting a special report segment on "${topic}", delivering in-depth insights and analysis in your unique character style, similar to a Daily Show or Tonight Show special feature. Draw from the anonymous field reports below to provide thoughtful insights, patterns, and connections without direct citations or references to specific sources. Focus on building a narrative that's engaging, opinionated, and revealing.

As the host, you should:

1. Open with a charismatic introduction to the special report, infused with your personality's flair.
2. Synthesize the reports into key insights about ${topic}, highlighting emerging patterns and deeper implications.
3. Provide your expert take, drawing connections and offering analysis that's more than surface-level.
4. Incorporate humor, satire, or witty observations where it fits your style.
5. Point out contradictions, trends, or hidden stories emerging from the information.
6. Build a cohesive story that explains the bigger picture.
7. End with forward-looking insights on what this means and what's next.

Remember: Emphasize insights and your character's perspective over quoting sources. Keep it character-driven, like a late-night show special.

CRITICAL: Keep your entire response under 5000 characters. Be engaging, insightful, and true to your character.

FIELD REPORTS ON "${topic.toUpperCase()}":
${postsContent}

Now, deliver your special report on ${topic} - what's the deeper story here?`;
        } else {
            expertTask = `You're anchoring a PBS-style news wrap-up with a heavy editorial skew, delivered in your distinctive character voice like a Daily Show or Tonight Show host providing opinionated commentary. Use the anonymous social media insights below to summarize key stories, providing deep insights, editorial opinions, and connections without direct citations. Focus on 3-5 major topics, weaving in your personality's take with humor, satire, or sharp analysis.

As the anchor, you should:

1. Start with an opening that sets a thoughtful yet skewed tone, reflecting your character's style.
2. Select 3-5 key stories from the insights, providing summaries enriched with your editorial insights.
3. For each, offer in-depth analysis, opinions, and connections to broader contexts.
4. Infuse your character's humor, wit, or perspective to make it engaging and skewed.
5. Transition smoothly between stories, building an overall narrative of the day's events.
6. Highlight patterns, implications, and your take on what matters most.
7. End with a reflective sign-off on the day's news.

This should feel like a sophisticated news wrap with strong personality-driven editorializing, not just facts.

CRITICAL: Keep your entire response under 5000 characters. Be opinionated, insightful, and character-focused.

TODAY'S FIELD REPORTS:
${postsContent}

Now, give us your editorial news wrap - what's your skewed take on today's key stories?`;
        }
        
        // Get prompt and make Ollama request
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);
        
        // Format the response directly without Q&A format (since this is a social media broadcast)
        const { emoji, name } = getPersonalityFormatting(selectedExpert);
        // Filter out command execution complete message if it exists
        const filteredResponse = response.response.replace(/\[COMMAND EXECUTION COMPLETE\]/g, '');
        const cleanedResponse = filteredResponse.replace(/\n\n+/g, '\n');
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
