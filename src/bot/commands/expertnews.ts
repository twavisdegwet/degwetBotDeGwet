import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, getPersonalityFormatting } from '../personalities';
import { fetchBlueskyPosts, searchBlueskyPosts, formatBlueskyPostsForPrompt, formatBlueskyPostsForPromptAnonymous } from '../../api/clients/bskyclient';


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

        // Format posts for the prompt (anonymous for topics, normal for general news)
        const postsContent = topic ? formatBlueskyPostsForPromptAnonymous(posts) : formatBlueskyPostsForPrompt(posts);
        
        // Create different prompts based on whether we're doing topic search or general news
        let expertTask: string;
        
        if (topic) {
            expertTask = `You're hosting a special investigative segment tonight focusing on "${topic}". The information below comes from our field reporters and social media monitoring teams who are tracking developments and public sentiment around this topic. Your job is to analyze these field reports and create a compelling news story that gets to the heart of what's really happening.

As tonight's investigative host, you should:

1. Open by introducing the special topic segment with your signature style
2. Use the field reports as context and evidence to build your story about ${topic}
3. Focus on the substance and patterns in the information rather than individual sources
4. Analyze what these reports reveal about the current state of ${topic}
5. Connect different pieces of information to show the bigger picture
6. Share your expert analysis and interpretation of what's developing
7. Don't be afraid to call out inconsistencies or contradictions you see in the reports
8. Build a narrative that explains what's really going on behind the headlines
9. End with your take on what this means and what to watch for next

Remember: You're a news anchor analyzing field reports. Focus on the story, not the messengers. Use the information to inform your commentary without getting bogged down in individual social media handles or usernames.

CRITICAL: Keep your entire response under 5000 characters. Be engaging, authoritative, and provide sharp news analysis.

FIELD REPORTS ON "${topic.toUpperCase()}":
${postsContent}

Now give us your expert analysis of what's developing with ${topic} - what's the real story here?`;
        } else {
            expertTask = `You are hosting a segment on The Daily Show - witty, satirical, and unapologetically opinionated. The social media posts below represent the day's conversations and developments. Your job is to select 3-5 key stories, provide sharp commentary, make jokes, and offer your unique perspective on what these stories really mean, weaving them into a fun, conversational flow.

As a Daily Show-style commentator, you should:

1. Start with a humorous opening that sets a satirical tone for the segment
2. Choose only 3-5 most interesting or absurd stories - don't list everything
3. For each selected story, dive deep with extended commentary, multiple jokes, sarcastic remarks, and witty observations
4. Share YOUR unfiltered opinion on each story - what do YOU really think is going on? Expand on this with more thoughts and connections
5. Connect the stories to broader trends and patterns with satirical insight, transitioning smoothly between them
6. Don't be afraid to roast the people, policies, or situations involved - add layers of humor
7. Speak conversationally as if you're talking to a smart audience that gets your references, with a natural flow like a monologue
8. End with a punchy sign-off or what you're sarcastically "looking forward to" next

This should feel like a sharp, funny news segment with depth. Think more "Here's what's ridiculous about these few things and let me rant hilariously about them" rather than a bullet list of headlines. Be funny, opinionated, don't hold back, and make it engaging and conversational.

CRITICAL: Keep your entire response under 5000 characters. Speak in your distinctive voice with humor and conviction.

IMPORTANT: Do not include any command execution messages, technical metadata in your response. Only provide your satirical commentary.

TODAY'S SOCIAL MEDIA CONVERSATIONS:
${postsContent}

Now give us your Daily Show-style take on what's ridiculous today - pick a few stories that caught your eye and riff on them with plenty of commentary and jokes!`;
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
